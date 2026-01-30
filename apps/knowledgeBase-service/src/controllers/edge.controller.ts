import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { KnowledgeManagementService } from 'knowledgeBase-lib';
import { CreateEdgeDto } from '../dto/index';

@Controller('edges')
export class EdgeController {
  constructor(
    private readonly knowledgeManagementService: KnowledgeManagementService,
  ) {}

  @Post()
  async create(@Body() createEdgeDto: CreateEdgeDto) {
    const edgeData = {
      type: createEdgeDto.type,
      in: createEdgeDto.in,
      out: createEdgeDto.out,
    };

    return await this.knowledgeManagementService.createEdge(edgeData);
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    return await this.knowledgeManagementService.getEdge(id);
  }

  @Get()
  async findAll(
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return await this.knowledgeManagementService.findEdges(
      {},
      { limit, offset },
    );
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() updateData: any) {
    return await this.knowledgeManagementService.updateEdge(id, updateData);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return await this.knowledgeManagementService.deleteEdge(id);
  }

  @Get(':id/exists')
  async exists(@Param('id') id: string) {
    const edge = await this.knowledgeManagementService.getEdge(id);
    return { exists: !!edge };
  }

  @Get('by-type/:type')
  async findByType(
    @Param('type') type: 'start' | 'middle' | 'end',
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return await this.knowledgeManagementService.findEdges(
      { types: [type] },
      { limit, offset },
    );
  }

  @Get('by-nodes/:inId/:outId')
  async findByNodes(
    @Param('inId') inId: string,
    @Param('outId') outId: string,
  ) {
    const allEdges = await this.knowledgeManagementService.findEdges({});
    const filteredEdges = allEdges.filter(
      (edge) => edge.in === inId && edge.out === outId,
    );

    return {
      edges: filteredEdges,
      total: filteredEdges.length,
    };
  }
}
