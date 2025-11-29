import { Test, TestingModule } from '@nestjs/testing';
import { PropertyStorageMemoryService } from './property-storage.memory.service';
import { PropertyData } from '../types';

describe('PropertyStorageMemoryService', () => {
  let service: PropertyStorageMemoryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PropertyStorageMemoryService],
    }).compile();

    service = module.get<PropertyStorageMemoryService>(PropertyStorageMemoryService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new property with generated ID', async () => {
      const propertyData = {
        edgePath: ['node1', 'node2'],
        content: 'Test property content'
      };

      const result = await service.create(propertyData);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.content).toEqual(propertyData.content);
    });

    it('should generate unique IDs for different properties', async () => {
      const propertyData1 = {
        edgePath: ['node1'],
        content: 'Content 1'
      };
      const propertyData2 = {
        edgePath: ['node2'],
        content: 'Content 2'
      };

      const result1 = await service.create(propertyData1);
      const result2 = await service.create(propertyData2);

      expect(result1.id).not.toEqual(result2.id);
    });
  });

  describe('findById', () => {
    it('should return a property when found by ID', async () => {
      const propertyData = {
        edgePath: ['node1', 'node2'],
        content: 'Test property content'
      };
      const createdProperty = await service.create(propertyData);

      const result = await service.findById(createdProperty.id);

      expect(result).toEqual(createdProperty);
    });

    it('should return null when property is not found', async () => {
      const result = await service.findById('non-existent-id');
      expect(result).toBeNull();
    });
  });

  describe('findByIds', () => {
    it('should return properties for existing IDs', async () => {
      const propertyData1 = {
        edgePath: ['node1'],
        content: 'Content 1'
      };
      const propertyData2 = {
        edgePath: ['node2'],
        content: 'Content 2'
      };
      const createdProperty1 = await service.create(propertyData1);
      const createdProperty2 = await service.create(propertyData2);

      const results = await service.findByIds([createdProperty1.id, createdProperty2.id]);

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual(createdProperty1);
      expect(results[1]).toEqual(createdProperty2);
    });

    it('should return null for non-existent IDs', async () => {
      const propertyData = {
        edgePath: ['node1'],
        content: 'Content 1'
      };
      const createdProperty = await service.create(propertyData);

      const results = await service.findByIds([createdProperty.id, 'non-existent-id']);

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual(createdProperty);
      expect(results[1]).toBeNull();
    });
  });

  describe('update', () => {
    it('should update an existing property', async () => {
      const propertyData = {
        edgePath: ['node1', 'node2'],
        content: 'Original content'
      };
      const createdProperty = await service.create(propertyData);

      const updates = {
        content: 'Updated content'
      };
      const result = await service.update(createdProperty.id, updates);

      expect(result).toBeDefined();
      expect(result!.id).toEqual(createdProperty.id);
      expect(result!.content).toEqual(updates.content);
    });

    it('should return null when trying to update non-existent property', async () => {
      const updates = {
        content: 'Updated content'
      };
      const result = await service.update('non-existent-id', updates);
      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete an existing property', async () => {
      const propertyData = {
        edgePath: ['node1', 'node2'],
        content: 'Test content'
      };
      const createdProperty = await service.create(propertyData);

      const deleteResult = await service.delete(createdProperty.id);
      expect(deleteResult).toBe(true);

      const findResult = await service.findById(createdProperty.id);
      expect(findResult).toBeNull();
    });

    it('should return false when trying to delete non-existent property', async () => {
      const result = await service.delete('non-existent-id');
      expect(result).toBe(false);
    });
  });

  describe('exists', () => {
    it('should return true for existing property', async () => {
      const propertyData = {
        edgePath: ['node1', 'node2'],
        content: 'Test content'
      };
      const createdProperty = await service.create(propertyData);

      const result = await service.exists(createdProperty.id);
      expect(result).toBe(true);
    });

    it('should return false for non-existent property', async () => {
      const result = await service.exists('non-existent-id');
      expect(result).toBe(false);
    });
  });

  describe('clear', () => {
    it('should clear all properties', async () => {
      const propertyData1 = {
        edgePath: ['node1'],
        content: 'Content 1'
      };
      const propertyData2 = {
        edgePath: ['node2'],
        content: 'Content 2'
      };
      await service.create(propertyData1);
      await service.create(propertyData2);

      expect(await service.count()).toBe(2);

      service.clear();

      expect(await service.count()).toBe(0);
      const findResult1 = await service.findById('any-id');
      expect(findResult1).toBeNull();
    });
  });

  describe('count', () => {
    it('should return the correct count of properties', async () => {
      expect(await service.count()).toBe(0);

      const propertyData1 = {
        edgePath: ['node1'],
        content: 'Content 1'
      };
      await service.create(propertyData1);
      expect(await service.count()).toBe(1);

      const propertyData2 = {
        edgePath: ['node2'],
        content: 'Content 2'
      };
      await service.create(propertyData2);
      expect(await service.count()).toBe(2);

      await service.delete('any-id');
      expect(await service.count()).toBe(2); // No change since ID doesn't exist

      const createdProperty = await service.create({
        
        content: 'Content 3'
      });
      await service.delete(createdProperty.id);
      expect(await service.count()).toBe(2); // One property deleted
    });
  });
});
