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
} from '@nestjs/common';
import { KnowledgeManagementService } from 'knowledgeBase-lib';
import { CreateVertexDto } from '../dto/index';

@Controller('vertices')
export class VertexController {
  constructor(
    private readonly knowledgeManagementService: KnowledgeManagementService,
  ) {}

  @Post()
  async create(@Body() createVertexDto: CreateVertexDto) {
    const vertexData = {
      content: createVertexDto.content,
      type: createVertexDto.type,
      metadata: createVertexDto.metadata,
    };

    return await this.knowledgeManagementService.createVertex(vertexData);
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    return await this.knowledgeManagementService.getVertex(id);
  }

  @Get()
  async findAll(
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return await this.knowledgeManagementService.findVertices(
      {},
      { limit, offset },
    );
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() updateData: any) {
    return await this.knowledgeManagementService.updateVertex(id, updateData);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return await this.knowledgeManagementService.deleteVertex(id);
  }

  @Get(':id/exists')
  async exists(@Param('id') id: string) {
    const vertex = await this.knowledgeManagementService.getVertex(id);
    return { exists: !!vertex };
  }
}
