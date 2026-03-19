import { Module } from '@nestjs/common';
import { ArticleAnalysisController } from './article-analysis.controller.js';
import { ArticleAnalysisService } from './article-analysis.service.js';

@Module({
  controllers: [ArticleAnalysisController],
  providers: [ArticleAnalysisService],
  exports: [ArticleAnalysisService],
})
export class ArticleAnalysisModule {}
