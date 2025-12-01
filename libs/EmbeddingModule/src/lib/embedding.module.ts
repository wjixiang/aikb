import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { 
  EmbeddingService 
} from './services/embedding.service';
import { 
  EmbeddingController 
} from './controllers/embedding.controller';
import embeddingConfig from './config/embedding.config';

@Module({
  imports: [
    ConfigModule.forFeature(embeddingConfig),
  ],
  controllers: [EmbeddingController],
  providers: [EmbeddingService],
  exports: [EmbeddingService],
})
export class EmbeddingModule {}