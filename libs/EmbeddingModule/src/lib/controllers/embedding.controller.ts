import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  ValidationPipe,
  UsePipes,
  Logger
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { EmbeddingService } from '../services/embedding.service';
import type {
  EmbeddingRequest,
  EmbeddingResponse,
  BatchEmbeddingRequest,
  BatchEmbeddingResponse,
  HealthCheckResponse,
  EmbeddingStats,
  ProviderInfo
} from '../interfaces/embedding.interfaces';
import { EmbeddingProvider } from 'embedding';
import {
  EmbeddingRequestDto,
  EmbeddingResponseDto,
  BatchEmbeddingRequestDto,
  BatchEmbeddingResponseDto,
  ProviderInfoDto,
  HealthCheckResponseDto,
  EmbeddingStatsDto
} from '../dto/embedding.dto';

@ApiTags('embedding')
@Controller('embedding')
export class EmbeddingController {
  private readonly logger = new Logger(EmbeddingController.name);

  constructor(private readonly embeddingService: EmbeddingService) {}

  @Post('embed')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate embedding for text(s)' })
  @ApiResponse({ 
    status: 200, 
    description: 'Embedding generated successfully',
    type: EmbeddingResponseDto
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Bad request' 
  })
  @UsePipes(new ValidationPipe({ transform: true }))
  async embed(@Body() request: EmbeddingRequestDto): Promise<EmbeddingResponse> {
    this.logger.debug(`Embed request received for provider: ${request.provider || 'default'}`);
    return this.embeddingService.embed(request);
  }

  @Post('embed-batch')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate embeddings for multiple texts' })
  @ApiResponse({ 
    status: 200, 
    description: 'Batch embeddings generated successfully',
    type: BatchEmbeddingResponseDto
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Bad request' 
  })
  @UsePipes(new ValidationPipe({ transform: true }))
  async embedBatch(@Body() request: BatchEmbeddingRequestDto): Promise<BatchEmbeddingResponse> {
    this.logger.debug(`Batch embed request received for ${request.texts.length} texts`);
    return this.embeddingService.embedBatch(request);
  }

  @Get('providers')
  @ApiOperation({ summary: 'Get available embedding providers' })
  @ApiResponse({ 
    status: 200, 
    description: 'Available providers retrieved successfully',
    type: [ProviderInfoDto]
  })
  getProviders(): ProviderInfo[] {
    return this.embeddingService.getProviderInfo();
  }

  @Get('provider/current')
  @ApiOperation({ summary: 'Get current active provider' })
  @ApiResponse({ 
    status: 200, 
    description: 'Current provider retrieved successfully'
  })
  getCurrentProvider(): { provider: EmbeddingProvider } {
    return { provider: this.embeddingService.getProvider() };
  }

  @Post('provider/set')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set active embedding provider' })
  @ApiQuery({ name: 'provider', enum: EmbeddingProvider, required: true })
  @ApiResponse({ 
    status: 200, 
    description: 'Provider set successfully'
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Invalid provider' 
  })
  setProvider(@Query('provider') provider: EmbeddingProvider): { success: boolean; message: string } {
    const success = this.embeddingService.setProvider(provider);
    return {
      success,
      message: success 
        ? `Provider set to ${provider} successfully` 
        : `Failed to set provider to ${provider}`
    };
  }

  @Get('health')
  @ApiOperation({ summary: 'Check embedding service health' })
  @ApiResponse({ 
    status: 200, 
    description: 'Health check completed',
    type: HealthCheckResponseDto
  })
  async health(): Promise<HealthCheckResponse> {
    return this.embeddingService.healthCheck();
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get embedding service statistics' })
  @ApiResponse({ 
    status: 200, 
    description: 'Statistics retrieved successfully',
    type: EmbeddingStatsDto
  })
  getStats(): EmbeddingStats {
    return this.embeddingService.getStats();
  }

  @Post('stats/reset')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset embedding service statistics' })
  @ApiResponse({ 
    status: 200, 
    description: 'Statistics reset successfully'
  })
  resetStats(): { success: boolean; message: string } {
    this.embeddingService.resetStats();
    return {
      success: true,
      message: 'Statistics reset successfully'
    };
  }
}