import { EntityData, EntityDataWithId } from '../knowledge.type';
import {
  AbstractEntityContentStorage,
  AbstractEntityGraphStorage,
  AbstractEntityVectorStorage,
} from './abstract-storage';
import { ElasticsearchEntityContentStorage } from './elasticsearch-entity-content-storage';
import { AbstractEntityStorage } from './storage';

export default class EntityStorage extends AbstractEntityStorage {
  entityContentStorage: AbstractEntityContentStorage;
  entityGraphStorage: AbstractEntityGraphStorage;
  entityVectorStorage: AbstractEntityVectorStorage;

  constructor(
    entityContentStorage: AbstractEntityContentStorage,
    entityGraphStorage: AbstractEntityGraphStorage,
    entityVectorStorage: AbstractEntityVectorStorage,
  ) {
    super();
    this.entityContentStorage = entityContentStorage;
    this.entityGraphStorage = entityGraphStorage;
    this.entityVectorStorage = entityVectorStorage;
  }
  async create_new_entity(entity: EntityData): Promise<EntityDataWithId> {
    return await this.entityContentStorage.create_new_entity_content(
      entity,
      AbstractEntityStorage.generate_entity_id(),
    );
  }
}
