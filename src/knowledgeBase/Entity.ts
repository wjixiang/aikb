import { b } from 'baml_client';
import { EntityData, EntityDataWithId } from './knowledge.type';
import createLoggerWithPrefix from './logger';
import { Property } from './Property';
import { AbstractEntityStorage, Storage } from './storage/storage';

export default class Entity {
  entityId: string;
  data: EntityData;
  property: Property;
  logger = createLoggerWithPrefix('Entity');

  constructor(
    data: EntityData,
    private knowledgeStorage: AbstractEntityStorage,
  ) {
    this.data = data;
  }

  /**
   * 
   * @returns The defintion of current entity
   */
  get_definition(): string {
    return this.data.definition
  }

  /**
   * Create new entity by passing entity data directly.
   * @returns Status of entity creation, will return saved entityData if success, or `null` when creating process is failed.
   */
  static async create_entity_with_entity_data(data: EntityData, knowledgeStorage: AbstractEntityStorage): Promise<EntityDataWithId|null> {
    try {
      const savedData = await knowledgeStorage.create_new_entity(data)
      return savedData
    } catch (error) {
      createLoggerWithPrefix("create entity").error(`Create new entity failed: ${JSON.stringify(error)}`) 
      return null
    }
  }

  static async create_entity_with_ai(entity_name: string, entity_description: {[key:string]:string}[]){
    const ai_generated_definition = await b.Generate_plain_definition(entity_name, JSON.stringify(entity_description))
    return ai_generated_definition.definition
  }
}

async function shotEntity(scopePrompt: string) {
  this.logger.debug(
      `Start capture scope for ${JSON.stringify(this.data.name[0])}: ${scopePrompt}`,
    );

  const result = await b.Research(scopePrompt);
  this.logger.debug(`Capture result: ${result}`);
}