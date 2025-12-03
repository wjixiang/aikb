import { Injectable } from '@nestjs/common';
import { PropertyDBPrismaService } from 'property-db';
import { IPropertyStorage, PropertyData } from '../types';

@Injectable()
export class PropertyStorageService implements IPropertyStorage {
  constructor(private readonly prisma: PropertyDBPrismaService) {}

  /**
   * Create a new property
   * @param property The property data to create
   * @returns Promise resolving to the created property with generated ID
   */
  async create(property: Omit<PropertyData, 'id'>): Promise<PropertyData> {
    const createdProperty = await this.prisma.property.create({
      data: {
        content: property.content,
      },
    });

    return this.mapPrismaPropertyToPropertyData(createdProperty);
  }

  /**
   * Retrieve an property by ID
   * @param id The property ID
   * @returns Promise resolving to the property data or null if not found
   */
  async findById(id: string): Promise<PropertyData | null> {
    const property = await this.prisma.property.findUnique({
      where: { id },
    });

    return property ? this.mapPrismaPropertyToPropertyData(property) : null;
  }

  /**
   * Retrieve multiple properties by their IDs
   * @param ids Array of property IDs
   * @returns Promise resolving to array of properties (null for not found properties)
   */
  async findByIds(ids: string[]): Promise<(PropertyData | null)[]> {
    const properties = await this.prisma.property.findMany({
      where: { id: { in: ids } },
    });

    const propertyMap = new Map(
      properties.map((p) => [p.id, this.mapPrismaPropertyToPropertyData(p)]),
    );

    return ids.map((id) => propertyMap.get(id) || null);
  }

  /**
   * Update an existing property
   * @param id The property ID to update
   * @param updates Partial property data to update
   * @returns Promise resolving to the updated property or null if not found
   */
  async update(
    id: string,
    updates: Partial<Omit<PropertyData, 'id'>>,
  ): Promise<PropertyData | null> {
    try {
      const updatedProperty = await this.prisma.property.update({
        where: { id },
        data: {
          ...(updates.content && { content: updates.content }),
        },
      });

      return this.mapPrismaPropertyToPropertyData(updatedProperty);
    } catch (error) {
      return null;
    }
  }

  /**
   * Delete an property by ID
   * @param id The property ID to delete
   * @returns Promise resolving to true if deleted, false if not found
   */
  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.property.delete({
        where: { id },
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if an property exists
   * @param id The property ID
   * @returns Promise resolving to true if property exists
   */
  async exists(id: string): Promise<boolean> {
    const property = await this.prisma.property.findUnique({
      where: { id },
      select: { id: true },
    });
    return !!property;
  }

  /**
   * Map Prisma Property to PropertyData format
   * @param property Prisma Property
   * @returns PropertyData
   */
  private mapPrismaPropertyToPropertyData(property: any): PropertyData {
    return {
      id: property.id,
      content: property.content,
    };
  }
}
