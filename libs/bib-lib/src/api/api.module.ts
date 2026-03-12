import { Module } from '@nestjs/common';
import { SearchModule } from '../search/search.module.js';
import { ExportModule } from '../export/export.module.js';
import { ApiController } from './search/search.controller.js';

@Module({
  imports: [SearchModule, ExportModule],
  controllers: [ApiController],
  exports: [ApiController],
})
export class ApiModule {}
