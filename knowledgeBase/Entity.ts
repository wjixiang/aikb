import { b } from 'baml_client';
import { EntityData, EntityDataWithId, KnowledgeData } from './knowledge.type';
import createLoggerWithPrefix from './lib/logger';
import { AbstractEntityStorage, Storage } from './storage/storage';
import { TKnowledge } from './Knowledge';

export default class Entity {
  logger = createLoggerWithPrefix('Entity');

  constructor(
    private id: string,
    private data: EntityDataWithId,
    private entityStorage: AbstractEntityStorage,
  ) {}

  get_id() {
    return this.id;
  }

  /**
   *
   * @returns The defintion of current entity
   */
  get_definition(): string {
    return this.data.definition;
  }

  /**
   * Create new entity by passing entity data directly.
   * @returns Status of entity creation, will return saved entityData if success, or `null` when creating process is failed.
   */
  static create_entity_with_entity_data(data: EntityData): TEntity {
    return new TEntity(data);
  }

  static async create_entity_with_ai(
    entity_name: string,
    entity_description: { [key: string]: string }[],
  ): Promise<TEntity> {
    const ai_generated_definition = await b.Generate_plain_definition(
      entity_name,
      JSON.stringify(entity_description),
    );
    return new TEntity({
      name: [entity_name],
      tags: [],
      definition: ai_generated_definition.definition,
    });
  }

  async replace_entity_name(new_name:string[]) {
    const update_res = await this.entityStorage.entityContentStorage.update_entity(this.data, {
      name: new_name,
      tags: this.data.tags,
      definition: this.data.definition
    })
    this.data = update_res
    return this
  }

  create_knowledge_with_knowledge_data(data: KnowledgeData): TKnowledge {
    return new TKnowledge(data, this);
  }
}

/**
 * Temporary entity
 */
class TEntity {
  constructor(private data: EntityData) {}

  get_entity_data() {
    return this.data;
  }

  /**
   * Save and retrieve real entity from database.
   * @param entity_storage
   * @returns
   */
  async save(entity_storage: AbstractEntityStorage): Promise<Entity> {
    const save_res = await entity_storage.create_new_entity(this.data);
    return new Entity(
      save_res.id,
      { ...this.data, id: save_res.id },
      entity_storage,
    );
  }
}
