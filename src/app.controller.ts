import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Post('entities')
  async createEntity(@Body() body: { name: string[]; tags: string[]; definition: string }) {
    return await this.appService.createEntity(body.name, body.tags, body.definition);
  }

  @Get('search')
  async searchEntities(@Query('q') query: string) {
    return await this.appService.searchEntities(query);
  }
}
