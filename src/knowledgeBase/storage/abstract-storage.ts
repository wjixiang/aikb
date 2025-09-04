import { PropertyData, EntityData, KnowledgeData, KnowledgeDataWithId } from '../knowledge.type';


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

export abstract class AbstractKnowledgeStorage {
  abstract create_new_knowledge(knowledge: KnowledgeData): Promise<KnowledgeDataWithId>;
}