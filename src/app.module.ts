import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ElasticsearchEntityStorage } from './knowledgeBase/storage/elasticsearch-entity-storage';
import knowledgeManager from './knowledgeBase/knowledgeManager';

@Module({
  imports: [],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: 'ENTITY_STORAGE',
      useFactory: () => {
        const elasticsearchUrl =
          process.env.ELASTICSEARCH_URL || 'http://localhost:9200';
        return new ElasticsearchEntityStorage(elasticsearchUrl);
      },
    },
    {
      provide: 'KNOWLEDGE_MANAGER',
      useFactory: (entityStorage: ElasticsearchEntityStorage) => {
        return new knowledgeManager(entityStorage);
      },
      inject: ['ENTITY_STORAGE'],
    },
  ],
})
export class AppModule {}
