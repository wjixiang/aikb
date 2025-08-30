import { PropertyData, EntityData } from '../knowledge.type';

/**
 * Abstract base class for PropertyStorage to decouple from specific database implementations
 */
export abstract class AbstractPropertyStorage {
  abstract create_property(property: PropertyData): Promise<PropertyData>;
  abstract get_property_by_name(name: string[]): Promise<PropertyData | null>;
  abstract get_property_by_ids(ids: string[]): Promise<PropertyData[]>;
  abstract update_property(property: PropertyData): Promise<PropertyData>;
  abstract delete_property(name: string[]): Promise<boolean>;
  abstract search_properties(query: string): Promise<PropertyData[]>;
  abstract list_all_properties(): Promise<PropertyData[]>;
}

/**
 * Abstract base class for EntityStorage to decouple from specific database implementations
 */
export abstract class AbstractEntityStorage {
  abstract create_new_entity(entity: EntityData): Promise<EntityData>;
  abstract get_entity_by_name(name: string[]): Promise<EntityData | null>;
  abstract update_entity(entity: EntityData): Promise<EntityData>;
  abstract delete_entity(name: string[]): Promise<boolean>;
  abstract search_entities(query: string): Promise<EntityData[]>;
  abstract list_all_entities(): Promise<EntityData[]>;
}
