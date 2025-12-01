import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  HttpStatus,
  ValidationPipe
} from '@nestjs/common';
import { KnowledgeManagementService } from 'knowledgeBase-lib';
import { CreateEntityDto, SearchDto } from '../dto/index';

@Controller('entities')
export class EntityController {
  constructor(private readonly knowledgeManagementService: KnowledgeManagementService) {}

  @Post()
  async create(@Body() createEntityDto: CreateEntityDto) {
    // Convert DTO to entity data format
    const entityData = {
      nomanclature: createEntityDto.nomenclature.map(n => ({
        name: n.name,
        acronym: n.acronym || null,
        language: n.language
      })),
      abstract: {
        description: createEntityDto.abstract.description,
        embedding: {
          config: {
            model: createEntityDto.abstract.embedding.model as any,
            dimension: createEntityDto.abstract.embedding.dimensions,
            batchSize: 20,
            maxRetries: 3,
            timeout: 20000,
            provider: 'openai' as any // Default provider
          },
          vector: createEntityDto.abstract.embedding.vector
        }
      },
    };
    
    return await this.knowledgeManagementService.createEntity(entityData);
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    return await this.knowledgeManagementService.getEntity(id);
  }

  @Get()
  async findAll(
    @Query('limit') limit?: number,
    @Query('offset') offset?: number
  ) {
    return await this.knowledgeManagementService.findEntities({}, { limit, offset });
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateData: any
  ) {
    return await this.knowledgeManagementService.updateEntity(id, updateData);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return await this.knowledgeManagementService.deleteEntity(id);
  }

  @Post('search')
  async search(@Body() searchDto: SearchDto) {
    return await this.knowledgeManagementService.findEntities({
      textSearch: searchDto.query,
      languages: searchDto.language ? [searchDto.language] : undefined
    }, {
      limit: searchDto.limit,
      offset: searchDto.offset
    });
  }

  @Post('batch')
  async batch(@Body() batchData: { operations: any[], options?: any }) {
    // Convert operations to the format expected by the lib service
    const libOperations = batchData.operations.map(op => ({
      operationId: op.id || `op-${Date.now()}`,
      type: op.type,
      entityType: op.data?.type || 'entity',
      data: op.data,
      id: op.id,
      updates: op.updates
    }));
    
    return await this.knowledgeManagementService.executeBatch(libOperations, batchData.options);
  }

  @Get(':id/exists')
  async exists(@Param('id') id: string) {
    const entity = await this.knowledgeManagementService.getEntity(id);
    return { exists: !!entity };
  }
}