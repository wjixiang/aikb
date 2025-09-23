import { Injectable, Inject } from '@nestjs/common';
import knowledgeManager from './knowledgeBase/knowledgeManager';

@Injectable()
export class AppService {
  constructor(
    @Inject('KNOWLEDGE_MANAGER')
    private readonly knowledgeManager: knowledgeManager,
  ) {}

  getHello(): string {
    return 'Hello World!';
  }

  async createEntity(name: string[], tags: string[], definition: string) {
    const entityData = {
      name,
      tags,
      definition,
    };
    return await this.knowledgeManager.createNewEntity(entityData);
  }

  async searchEntities(query: string) {
    const storage = (this.knowledgeManager as any).entityStorage;
    return await storage.search_entities(query);
  }
}
