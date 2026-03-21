import { Module } from '@nestjs/common';
import { SearchModule } from '../search/search.module.js';
import { ExportModule } from '../export/export.module.js';
import { ImportModule } from '../import/import.module.js';
import { ApiController } from './search/search.controller.js';

@Module({
  imports: [SearchModule, ExportModule, ImportModule],
  controllers: [ApiController],
  exports: [ApiController],
})
export class ApiModule {}
