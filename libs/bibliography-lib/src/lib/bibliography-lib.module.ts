import { Module } from '@nestjs/common';
import { VectorModule } from './vector/vector.module';

@Module({
  imports: [VectorModule],
  controllers: [],
  providers: [],
  exports: [VectorModule],
})
export class BibliographyLibModule {}
