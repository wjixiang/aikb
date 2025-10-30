import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import {S3ElasticSearchLibraryStorage, ILibraryStorage} from '@aikb/bibliography'
import { UpdateMarkdownDto } from '@aikb/library-shared';

@Injectable()
export class AppService {
  libraryStorage: ILibraryStorage | null = null
  private getLibraryStorage() {
    if(this.libraryStorage === null) {
      this.libraryStorage = new S3ElasticSearchLibraryStorage()
    }
    return this.libraryStorage
  }

  async updateLibraryItemMarkdown(updateMarkdownDto: UpdateMarkdownDto): Promise<{ success: boolean; message: string }> {
    const storage = this.getLibraryStorage();
    
    // Check if item exists first
    const existingItem = await storage.getMetadata(updateMarkdownDto.id);
    if (!existingItem) {
      throw new NotFoundException(`Library item with ID ${updateMarkdownDto.id} not found`);
    }

    try {
      await storage.saveMarkdown(updateMarkdownDto.id, updateMarkdownDto.markdownContent);
      
      return {
        success: true,
        message: `Markdown content for library item with ID ${updateMarkdownDto.id} has been successfully updated`
      };
    } catch (error) {
      throw new BadRequestException(`Failed to update markdown content: ${error.message}`);
    }
  }

  async getLibraryItemMarkdown(id: string): Promise<{ markdownContent: string }> {
    const storage = this.getLibraryStorage();
    
    // Check if item exists first
    const existingItem = await storage.getMetadata(id);
    if (!existingItem) {
      throw new NotFoundException(`Library item with ID ${id} not found`);
    }

    const markdownContent = await storage.getMarkdown(id);
    if (!markdownContent) {
      throw new NotFoundException(`Markdown content for library item with ID ${id} not found`);
    }

    return { markdownContent };
  }
}
