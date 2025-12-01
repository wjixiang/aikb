import { Injectable } from '@nestjs/common';
import { IPropertyStorage, PropertyData } from '../types';

/**
 * In-memory implementation of IPropertyStorage for testing and development purposes.
 * This implementation stores properties in a simple Map structure.
 */
@Injectable()
export class PropertyStorageMemoryService implements IPropertyStorage {
  private properties: Map<string, PropertyData> = new Map();

  /**
   * Create a new property
   * @param property The property data to create
   * @returns Promise resolving to the created property with generated ID
   */
  async create(property: Omit<PropertyData, 'id'>): Promise<PropertyData> {
    const id = this.generateId();
    const newProperty: PropertyData = {
      id,
      ...property,
    };
    this.properties.set(id, newProperty);
    return { ...newProperty };
  }

  /**
   * Retrieve an property by ID
   * @param id The property ID
   * @returns Promise resolving to the property data or null if not found
   */
  async findById(id: string): Promise<PropertyData | null> {
    const property = this.properties.get(id);
    return property ? { ...property } : null;
  }

  /**
   * Retrieve multiple properties by their IDs
   * @param ids Array of property IDs
   * @returns Promise resolving to array of properties (null for not found properties)
   */
  async findByIds(ids: string[]): Promise<(PropertyData | null)[]> {
    return ids.map((id) => {
      const property = this.properties.get(id);
      return property ? { ...property } : null;
    });
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
    const existingProperty = this.properties.get(id);
    if (!existingProperty) {
      return null;
    }

    const updatedProperty: PropertyData = {
      ...existingProperty,
      ...updates,
      id, // Ensure ID doesn't change
    };
    this.properties.set(id, updatedProperty);
    return { ...updatedProperty };
  }

  /**
   * Delete an property by ID
   * @param id The property ID to delete
   * @returns Promise resolving to true if deleted, false if not found
   */
  async delete(id: string): Promise<boolean> {
    return this.properties.delete(id);
  }

  /**
   * Check if an property exists
   * @param id The property ID
   * @returns Promise resolving to true if property exists
   */
  async exists(id: string): Promise<boolean> {
    return this.properties.has(id);
  }

  /**
   * Generate a unique ID for properties
   * @returns A unique ID string
   */
  private generateId(): string {
    // Simple ID generation - in production, use UUID or similar
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  /**
   * Clear all properties (useful for testing)
   */
  clear(): void {
    this.properties.clear();
  }

  /**
   * Get the current number of stored properties
   * @returns Number of properties
   */
  count(): number {
    return this.properties.size;
  }
}
