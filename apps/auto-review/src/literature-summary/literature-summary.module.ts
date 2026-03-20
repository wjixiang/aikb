import { Module } from '@nestjs/common';
import { LiteratureSummaryController } from './literature-summary.controller.js';
import { LiteratureSummaryService } from './literature-summary.service.js';

@Module({
  controllers: [LiteratureSummaryController],
  providers: [LiteratureSummaryService],
  exports: [LiteratureSummaryService],
})
export class LiteratureSummaryModule {}
