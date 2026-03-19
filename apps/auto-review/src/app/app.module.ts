import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { ArticleAnalysisModule } from '../article-analysis/article-analysis.module.js';

@Module({
    controllers: [AppController],
    providers: [AppService],
    imports: [ArticleAnalysisModule],
})
export class AppModule {}
