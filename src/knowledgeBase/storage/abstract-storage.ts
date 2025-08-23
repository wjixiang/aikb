import { Property, Entity } from '../knowledge.type';

/**
 * Abstract base class for PropertyStorage to decouple from specific database implementations
 */
export abstract class AbstractPropertyStorage {
  abstract create_property(property: Property): Promise<Property>;
  abstract get_property_by_name(name: string[]): Promise<Property | null>;
  abstract update_property(property: Property): Promise<Property>;
  abstract delete_property(name: string[]): Promise<boolean>;
  abstract search_properties(query: string): Promise<Property[]>;
  abstract list_all_properties(): Promise<Property[]>;
}

/**
 * Abstract base class for EntityStorage to decouple from specific database implementations
 */
export abstract class AbstractEntityStorage {
  abstract create_new_entity(entity: Entity): Promise<Entity>;
  abstract get_entity_by_name(name: string[]): Promise<Entity | null>;
  abstract update_entity(entity: Entity): Promise<Entity>;
  abstract delete_entity(name: string[]): Promise<boolean>;
  abstract search_entities(query: string): Promise<Entity[]>;
  abstract list_all_entities(): Promise<Entity[]>;
}