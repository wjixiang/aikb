import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ElasticsearchEntityContentStorage } from '../knowledgeBase/storage/elasticsearch-entity-content-storage';
import knowledgeManager from '../knowledgeBase/knowledgeManager';

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
        return new ElasticsearchEntityContentStorage(elasticsearchUrl);
      },
    },
    {
      provide: 'KNOWLEDGE_MANAGER',
      useFactory: (entityStorage: ElasticsearchEntityContentStorage) => {
        return new knowledgeManager(entityStorage);
      },
      inject: ['ENTITY_STORAGE'],
    },
  ],
})
export class AppModule {}
