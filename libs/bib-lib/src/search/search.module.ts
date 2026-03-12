import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { SearchService } from './search.service.js';
import { KeywordSearchService } from './keyword/keyword-search.service.js';
import { SemanticSearchService } from './semantic/semantic-search.service.js';
import { HybridSearchService } from './hybrid/hybrid-search.service.js';

@Module({
  imports: [PrismaModule],
  providers: [
    SearchService,
    KeywordSearchService,
    SemanticSearchService,
    HybridSearchService,
  ],
  exports: [
    SearchService,
    KeywordSearchService,
    SemanticSearchService,
    HybridSearchService,
  ],
})
export class SearchModule {}
