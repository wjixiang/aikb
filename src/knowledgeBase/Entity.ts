import { b } from 'baml_client';
import { EntityData } from './knowledge.type';
import createLoggerWithPrefix from './logger';
import { Property } from './Property';
import { KnowledgeStorage } from './storage/storage';

export default class Entity {
  data: EntityData;
  property: Property;
  logger = createLoggerWithPrefix('Entity');

  constructor(
    data: EntityData,
    private knowledgeStorage: KnowledgeStorage,
  ) {
    this.data = data;
  }


  async shot(scopePrompt: string) {
    this.logger.debug(
      `Start capture scope for ${JSON.stringify(this.data.name[0])}: ${scopePrompt}`,
    );

    const result = await b.Research(scopePrompt);
    this.logger.debug(`Capture result: ${result}`);
  }
}
