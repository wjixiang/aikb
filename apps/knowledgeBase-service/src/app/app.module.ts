import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { KnowledgeManagementModule } from '../knowledge-management.module';

@Module({
  imports: [KnowledgeManagementModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
