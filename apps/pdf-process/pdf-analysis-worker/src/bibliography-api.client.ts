import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { LibraryItem } from '@aikb/bibliography';
import {
  UpdateMetadataDto,
  UpdateProcessingStatusDto,
  PdfDownloadUrlDto,
} from 'library-shared';
import createLoggerWithPrefix from '@aikb/log-management/logger';

const logger = createLoggerWithPrefix('BibliographyApiClient');

export class BibliographyApiClient {
  private axiosInstance: AxiosInstance;

  constructor(private baseUrl: string) {
    this.axiosInstance = axios.create({
      baseURL: baseUrl,
      timeout: 30000, // 30 seconds timeout
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor for logging
    this.axiosInstance.interceptors.request.use(
      (config) => {
        logger.debug(
          `Making request to ${config.method?.toUpperCase()} ${config.url}`,
        );
        return config;
      },
      (error) => {
        logger.error('Request error:', error);
        return Promise.reject(error);
      },
    );

    // Add response interceptor for logging
    this.axiosInstance.interceptors.response.use(
      (response) => {
        logger.debug(
          `Received response from ${response.config.url}: ${response.status}`,
        );
        return response;
      },
      (error) => {
        logger.error('Response error:', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          url: error.config?.url,
        });
        return Promise.reject(error);
      },
    );
  }

  /**
   * Get library item by ID
   */
  async getLibraryItem(id: string): Promise<LibraryItem> {
    try {
      const response: AxiosResponse<LibraryItem> = await this.axiosInstance.get(
        `/api/library-items/${id}`,
      );
      return response.data;
    } catch (error) {
      logger.error(`Failed to get library item ${id}:`, error);
      throw new Error(
        `Failed to get library item: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Update library item metadata
   */
  async updateLibraryItemMetadata(
    id: string,
    updateData: UpdateMetadataDto,
  ): Promise<LibraryItem> {
    try {
      const response: AxiosResponse<LibraryItem> = await this.axiosInstance.put(
        `/api/library-items/${id}/metadata`,
        updateData,
      );
      return response.data;
    } catch (error) {
      logger.error(`Failed to update library item metadata ${id}:`, error);
      throw new Error(
        `Failed to update library item metadata: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Update PDF processing status
   */
  async updatePdfProcessingStatus(
    id: string,
    statusUpdate: UpdateProcessingStatusDto,
  ): Promise<LibraryItem> {
    try {
      const response: AxiosResponse<LibraryItem> = await this.axiosInstance.put(
        `/api/library-items/${id}/processing-status`,
        statusUpdate,
      );
      return response.data;
    } catch (error) {
      logger.error(`Failed to update PDF processing status ${id}:`, error);
      throw new Error(
        `Failed to update PDF processing status: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Get PDF download URL
   */
  async getPdfDownloadUrl(id: string): Promise<PdfDownloadUrlDto> {
    try {
      const response: AxiosResponse<PdfDownloadUrlDto> =
        await this.axiosInstance.get(`/api/library-items/${id}/download-url`);
      return response.data;
    } catch (error) {
      logger.error(`Failed to get PDF download URL ${id}:`, error);
      throw new Error(
        `Failed to get PDF download URL: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}
