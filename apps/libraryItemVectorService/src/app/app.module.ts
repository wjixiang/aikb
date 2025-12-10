import { Module } from '@nestjs/common';
import { AppGrpcController } from './app.grpc.controller';
import { BibliographyLibModule } from 'bibliography-lib';

@Module({
  imports: [BibliographyLibModule],
  controllers: [AppGrpcController],
  providers: [],
})
export class AppModule {}
