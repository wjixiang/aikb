import { describe, it, expect, vi } from "vitest";
import Entity from "./Entity";
import { Property } from "./Property";
import { KnowledgeStorage } from "./storage/storage";
import { EntityData, PropertyData } from "./knowledge.type";

describe("Entity", () => {
  it('Load property correctly', async () => {
    // Mock data
    const mockEntityData: EntityData = {
      name: ['test', 'entity'],
      tags: ['test'],
      definition: 'A test entity',
      propertyBindIds: ['prop1', 'prop2']
    };

    const mockPropertyData1: PropertyData = {
      name: ['test', 'property1'],
      content: 'Test property content 1'
    };

    const mockPropertyData2: PropertyData = {
      name: ['test', 'property2'],
      content: 'Test property content 2'
    };

    // Mock KnowledgeStorage
    const mockGetPropertyByIds = vi.fn().mockResolvedValue([mockPropertyData1, mockPropertyData2]);
    const mockKnowledgeStorage = {
      propertyStorage: {
        get_property_by_ids: mockGetPropertyByIds
      }
    } as unknown as KnowledgeStorage;

    // Create Entity instance
    const entity = new Entity(mockEntityData, mockKnowledgeStorage);

    // Call load_property method
    const result = await entity.load_property();

    // Verify that propertyStorage.get_property_by_ids was called with correct IDs
    expect(mockGetPropertyByIds).toHaveBeenCalledWith(
      ['prop1', 'prop2']
    );

    // Verify that the result contains Property instances
    expect(result).toBeInstanceOf(Array);
    expect(result).toHaveLength(2);
    expect(result[0]).toBeInstanceOf(Property);
    expect(result[1]).toBeInstanceOf(Property);
    
    // Verify property data is correctly set
    expect(result[0].data).toEqual(mockPropertyData1);
    expect(result[1].data).toEqual(mockPropertyData2);
  });

  it('Load property correctly when no property bind IDs', async () => {
    // Mock data with no property bind IDs
    const mockEntityData: EntityData = {
      name: ['test', 'entity'],
      tags: ['test'],
      definition: 'A test entity',
      propertyBindIds: []
    };

    // Mock KnowledgeStorage
    const mockGetPropertyByIds = vi.fn().mockResolvedValue([]);
    const mockKnowledgeStorage = {
      propertyStorage: {
        get_property_by_ids: mockGetPropertyByIds
      }
    } as unknown as KnowledgeStorage;

    // Create Entity instance
    const entity = new Entity(mockEntityData, mockKnowledgeStorage);

    // Call load_property method
    const result = await entity.load_property();

    // Verify that propertyStorage.get_property_by_ids was called with empty array
    expect(mockGetPropertyByIds).toHaveBeenCalledWith([]);

    // Verify that the result is an empty array
    expect(result).toBeInstanceOf(Array);
    expect(result).toHaveLength(0);
  });

  it('Load property correctly when property not found', async () => {
    // Mock data
    const mockEntityData: EntityData = {
      name: ['test', 'entity'],
      tags: ['test'],
      definition: 'A test entity',
      propertyBindIds: ['nonexistent']
    };

    // Mock KnowledgeStorage returning empty array
    const mockGetPropertyByIds = vi.fn().mockResolvedValue([]);
    const mockKnowledgeStorage = {
      propertyStorage: {
        get_property_by_ids: mockGetPropertyByIds
      }
    } as unknown as KnowledgeStorage;

    // Create Entity instance
    const entity = new Entity(mockEntityData, mockKnowledgeStorage);

    // Call load_property method
    const result = await entity.load_property();

    // Verify that propertyStorage.get_property_by_ids was called with correct ID
    expect(mockGetPropertyByIds).toHaveBeenCalledWith(['nonexistent']);

    // Verify that the result is an empty array
    expect(result).toBeInstanceOf(Array);
    expect(result).toHaveLength(0);
  });
});