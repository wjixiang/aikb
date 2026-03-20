import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { ArticleAnalysisModule } from '../article-analysis/article-analysis.module.js';
import { LiteratureSummaryModule } from '../literature-summary/literature-summary.module.js';
import { SearchModule } from '../search/search.module.js';

@Module({
    controllers: [AppController],
    providers: [AppService],
    imports: [ArticleAnalysisModule, LiteratureSummaryModule, SearchModule],
})
export class AppModule {}
