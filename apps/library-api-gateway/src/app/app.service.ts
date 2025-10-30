import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { Response } from 'express';
import { firstValueFrom } from 'rxjs';
import { AxiosResponse } from 'axios';

@Injectable()
export class AppService {
  private readonly metadataServiceUrl = process.env.METADATA_SERVICE_URL || 'http://localhost:3001';
  private readonly contentServiceUrl = process.env.CONTENT_SERVICE_URL || 'http://localhost:3002';
  private readonly storageServiceUrl = process.env.STORAGE_SERVICE_URL || 'http://localhost:3003';

  constructor(private readonly httpService: HttpService) {}

  async forwardToMetadataService(method: string, path: string, data?: any) {
    const url = `${this.metadataServiceUrl}/${path}`;
    
    try {
      const response: AxiosResponse = await firstValueFrom(
        this.httpService.request({
          method,
          url,
          data,
          headers: {
            'Content-Type': 'application/json',
          },
        })
      );
      
      return response.data;
    } catch (error) {
      throw new Error(`Failed to forward request to metadata service: ${error.message}`);
    }
  }

  async forwardToContentService(method: string, path: string, data?: any) {
    const url = `${this.contentServiceUrl}/${path}`;
    
    try {
      const response: AxiosResponse = await firstValueFrom(
        this.httpService.request({
          method,
          url,
          data,
          headers: {
            'Content-Type': 'application/json',
          },
        })
      );
      
      return response.data;
    } catch (error) {
      throw new Error(`Failed to forward request to content service: ${error.message}`);
    }
  }

  async forwardToStorageService(method: string, path: string, data?: any, res?: Response) {
    const url = `${this.storageServiceUrl}/${path}`;
    
    try {
      if (res && method === 'GET' && path.includes('/download')) {
        // For file downloads, stream the response
        const response: AxiosResponse = await firstValueFrom(
          this.httpService.request({
            method,
            url,
            responseType: 'stream',
          })
        );
        
        response.data.pipe(res);
        return;
      } else {
        const response: AxiosResponse = await firstValueFrom(
          this.httpService.request({
            method,
            url,
            data,
            headers: {
              'Content-Type': 'application/json',
            },
          })
        );
        
        return response.data;
      }
    } catch (error) {
      throw new Error(`Failed to forward request to storage service: ${error.message}`);
    }
  }
}
