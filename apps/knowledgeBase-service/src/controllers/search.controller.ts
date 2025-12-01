import { 
  Controller, 
  Get, 
  Post, 
  Query, 
  Body 
} from '@nestjs/common';
import { KnowledgeManagementService } from 'knowledgeBase-lib';
import { SearchDto } from '../dto/index';

@Controller('search')
export class SearchController {
  constructor(private readonly knowledgeManagementService: KnowledgeManagementService) {}

  @Post()
  async search(@Body() searchDto: SearchDto) {
    // Search entities
    const entities = await this.knowledgeManagementService.findEntities({
      textSearch: searchDto.query,
      languages: searchDto.language ? [searchDto.language] : undefined
    }, {
      limit: searchDto.limit,
      offset: searchDto.offset
    });

    // Search vertices
    const vertices = await this.knowledgeManagementService.findVertices({
      contentSearch: searchDto.query
    }, {
      limit: searchDto.limit,
      offset: searchDto.offset
    });

    // Search properties - using findByIds since search is not available
    // For now, return empty array as search is not implemented
    const properties: any[] = [];

    return {
      entities,
      vertices,
      properties,
      total: entities.length + vertices.length + properties.length
    };
  }

  @Get('entities')
  async searchEntities(
    @Query('query') query: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @Query('language') language?: 'en' | 'zh'
  ) {
    return await this.knowledgeManagementService.findEntities({
      textSearch: query,
      languages: language ? [language] : undefined
    }, {
      limit,
      offset
    });
  }

  @Get('similar')
  async findBySimilarity(
    @Query('vector') vectorString: string,
    @Query('limit') limit?: number,
    @Query('threshold') threshold?: number
  ) {
    const vector = vectorString.split(',').map(v => parseFloat(v.trim()));
    return await this.knowledgeManagementService.findEntities({
      vectorSearch: {
        vector,
        threshold,
        limit
      }
    });
  }
}