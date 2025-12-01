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
import { CreatePropertyDto } from '../dto/index';

@Controller('properties')
export class PropertyController {
  constructor(
    private readonly knowledgeManagementService: KnowledgeManagementService,
  ) {}

  @Post()
  async create(@Body() createPropertyDto: CreatePropertyDto) {
    const propertyData = {
      content: createPropertyDto.content,
    };

    return await this.knowledgeManagementService.createProperty(propertyData);
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    return await this.knowledgeManagementService.getProperty(id);
  }

  @Get()
  async findAll(
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return await this.knowledgeManagementService.findProperties(
      {},
      { limit, offset },
    );
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() updateData: any) {
    return await this.knowledgeManagementService.updateProperty(id, updateData);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return await this.knowledgeManagementService.deleteProperty(id);
  }

  @Get(':id/exists')
  async exists(@Param('id') id: string) {
    const property = await this.knowledgeManagementService.getProperty(id);
    return { exists: !!property };
  }
}
