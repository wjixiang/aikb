import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import {S3ElasticSearchLibraryStorage, ILibraryStorage, ItemMetadata} from '@aikb/bibliography'
import { CreateLibraryItemDto, UpdateLibraryItemDto, DeleteLibraryItemDto, UpdateMarkdownDto } from './dto';

@Injectable()
export class AppService {
  libraryStorage: ILibraryStorage | null = null
  private getLibraryStorage() {
    if(this.libraryStorage === null) {
      this.libraryStorage = new S3ElasticSearchLibraryStorage()
    }
    return this.libraryStorage
  }
  getData(): { message: string } {
    return { message: 'Hello API' };
  }

  async createLibraryItem(createLibraryItemDto: CreateLibraryItemDto): Promise<ItemMetadata & { id: string }> {
    const storage = this.getLibraryStorage();
    
    const metadata: ItemMetadata = {
      ...createLibraryItemDto,
      dateAdded: new Date(),
      dateModified: new Date(),
    };

    return await storage.saveMetadata(metadata);
  }

  async deleteLibraryItem(deleteLibraryItemDto: DeleteLibraryItemDto): Promise<{ success: boolean; message: string }> {
    const storage = this.getLibraryStorage();
    
    // Check if item exists first
    const existingItem = await storage.getMetadata(deleteLibraryItemDto.id);
    if (!existingItem) {
      throw new NotFoundException(`Library item with ID ${deleteLibraryItemDto.id} not found`);
    }

    const deleted = await storage.deleteMetadata(deleteLibraryItemDto.id);
    
    if (!deleted) {
      throw new BadRequestException(`Failed to delete library item with ID ${deleteLibraryItemDto.id}`);
    }

    return {
      success: true,
      message: `Library item with ID ${deleteLibraryItemDto.id} has been successfully deleted`
    };
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

  async getLibraryItem(id: string): Promise<ItemMetadata> {
    const storage = this.getLibraryStorage();
    
    const item = await storage.getMetadata(id);
    if (!item) {
      throw new NotFoundException(`Library item with ID ${id} not found`);
    }

    return item;
  }
}
