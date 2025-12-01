import { Test, TestingModule } from '@nestjs/testing';
import { PropertyStorageService } from './property-storage.service';
import { PropertyDBPrismaService } from 'property-db';
import { PropertyData } from '../types';

describe('PropertyStorageService', () => {
  let service: PropertyStorageService;
  let prismaService: PropertyDBPrismaService;

  const mockPrismaService = {
    property: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PropertyStorageService,
        {
          provide: PropertyDBPrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<PropertyStorageService>(PropertyStorageService);
    prismaService = module.get<PropertyDBPrismaService>(PropertyDBPrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new property', async () => {
      const propertyData: Omit<PropertyData, 'id'> = {
        content: 'Test property content',
      };

      const createdProperty = {
        id: 'test-id',
        content: 'Test property content',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.property.create.mockResolvedValue(createdProperty);

      const result = await service.create(propertyData);

      expect(mockPrismaService.property.create).toHaveBeenCalledWith({
        data: {
          content: 'Test property content',
        },
      });
      expect(result).toEqual({
        id: 'test-id',
        content: 'Test property content',
      });
    });
  });

  describe('findById', () => {
    it('should return a property when found', async () => {
      const property = {
        id: 'test-id',
        content: 'Test property content',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.property.findUnique.mockResolvedValue(property);

      const result = await service.findById('test-id');

      expect(mockPrismaService.property.findUnique).toHaveBeenCalledWith({
        where: { id: 'test-id' },
      });
      expect(result).toEqual({
        id: 'test-id',
        content: 'Test property content',
      });
    });

    it('should return null when property not found', async () => {
      mockPrismaService.property.findUnique.mockResolvedValue(null);

      const result = await service.findById('non-existent-id');

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should update an existing property', async () => {
      const updatedProperty = {
        id: 'test-id',
        content: 'Updated property content',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.property.update.mockResolvedValue(updatedProperty);

      const result = await service.update('test-id', {
        content: 'Updated property content',
      });

      expect(mockPrismaService.property.update).toHaveBeenCalledWith({
        where: { id: 'test-id' },
        data: {
          content: 'Updated property content',
        },
      });
      expect(result).toEqual({
        id: 'test-id',
        content: 'Updated property content',
      });
    });

    it('should return null when property not found for update', async () => {
      mockPrismaService.property.update.mockRejectedValue(new Error('Property not found'));

      const result = await service.update('non-existent-id', {
        content: 'Updated content',
      });

      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete an existing property', async () => {
      mockPrismaService.property.delete.mockResolvedValue({});

      const result = await service.delete('test-id');

      expect(mockPrismaService.property.delete).toHaveBeenCalledWith({
        where: { id: 'test-id' },
      });
      expect(result).toBe(true);
    });

    it('should return false when property not found for deletion', async () => {
      mockPrismaService.property.delete.mockRejectedValue(new Error('Property not found'));

      const result = await service.delete('non-existent-id');

      expect(result).toBe(false);
    });
  });

  describe('exists', () => {
    it('should return true when property exists', async () => {
      mockPrismaService.property.findUnique.mockResolvedValue({ id: 'test-id' });

      const result = await service.exists('test-id');

      expect(mockPrismaService.property.findUnique).toHaveBeenCalledWith({
        where: { id: 'test-id' },
        select: { id: true },
      });
      expect(result).toBe(true);
    });

    it('should return false when property does not exist', async () => {
      mockPrismaService.property.findUnique.mockResolvedValue(null);

      const result = await service.exists('non-existent-id');

      expect(result).toBe(false);
    });
  });
});
