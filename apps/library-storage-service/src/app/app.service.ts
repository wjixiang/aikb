import { Injectable, NotFoundException } from '@nestjs/common';
import {S3ElasticSearchLibraryStorage, ILibraryStorage} from '@aikb/bibliography'

@Injectable()
export class AppService {
  libraryStorage: ILibraryStorage | null = null
  private getLibraryStorage() {
    if(this.libraryStorage === null) {
      this.libraryStorage = new S3ElasticSearchLibraryStorage()
    }
    return this.libraryStorage
  }

  async uploadPdf(fileName: string, fileData: Buffer): Promise<{ id: string; s3Key: string; url: string }> {
    const storage = this.getLibraryStorage();
    
    try {
      const pdf = await storage.uploadPdf(fileData, fileName);
      return {
        id: pdf.id,
        s3Key: pdf.s3Key,
        url: pdf.url
      };
    } catch (error) {
      throw new Error(`Failed to upload PDF: ${error.message}`);
    }
  }

  async getPdf(id: string): Promise<Buffer> {
    const storage = this.getLibraryStorage();
    
    // First get the metadata to find the s3Key
    const metadata = await storage.getMetadata(id);
    if (!metadata || !metadata.s3Key) {
      throw new NotFoundException(`PDF with ID ${id} not found`);
    }

    try {
      return await storage.getPdf(metadata.s3Key);
    } catch (error) {
      throw new Error(`Failed to retrieve PDF: ${error.message}`);
    }
  }

  async getPdfDownloadUrl(id: string): Promise<{ downloadUrl: string }> {
    const storage = this.getLibraryStorage();
    
    // First get the metadata to find the s3Key
    const metadata = await storage.getMetadata(id);
    if (!metadata || !metadata.s3Key) {
      throw new NotFoundException(`PDF with ID ${id} not found`);
    }

    try {
      const downloadUrl = await storage.getPdfDownloadUrl(metadata.s3Key);
      return { downloadUrl };
    } catch (error) {
      throw new Error(`Failed to generate download URL: ${error.message}`);
    }
  }
}
