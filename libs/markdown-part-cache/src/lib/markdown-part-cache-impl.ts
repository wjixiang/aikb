import { v4 as uuidv4 } from 'uuid';
import createLoggerWithPrefix from '@aikb/log-management/logger';
import {
  IMarkdownPartCache,
  MarkdownPartCacheData,
} from './markdown-part-cache.interface';

const logger = createLoggerWithPrefix('MarkdownPartCache');

/**
 * In-memory implementation of markdown part cache
 * Suitable for development and testing environments
 */
export class MarkdownPartCache implements IMarkdownPartCache {
  private cache: Map<string, Map<number, MarkdownPartCacheData>> = new Map();

  /**
   * Store a markdown part in the cache
   */
  async storePart(
    pdfId: string,
    partNumber: number,
    markdownContent: string,
    metadata?: any,
  ): Promise<boolean> {
    const now = new Date();

    const cacheData: MarkdownPartCacheData = {
      pdfId,
      partNumber,
      content: markdownContent,
      metadata,
      cachedAt: now,
      updatedAt: now,
    };

    if (!this.cache.has(pdfId)) {
      this.cache.set(pdfId, new Map());
    }

    this.cache.get(pdfId)!.set(partNumber, cacheData);

    logger.debug(`Stored markdown part ${partNumber} for PDF ${pdfId}`);
    return true;
  }

  /**
   * Retrieve a markdown part from the cache
   */
  async getPart(
    pdfId: string,
    partNumber: number,
  ): Promise<{
    content: string;
    metadata?: any;
    cachedAt: Date;
  } | null> {
    const pdfCache = this.cache.get(pdfId);

    if (!pdfCache) {
      logger.debug(`PDF cache not found for PDF ${pdfId}`);
      return null;
    }

    const cacheData = pdfCache.get(partNumber);

    if (!cacheData) {
      logger.debug(`Part ${partNumber} not found in cache for PDF ${pdfId}`);
      return null;
    }

    return {
      content: cacheData.content,
      metadata: cacheData.metadata,
      cachedAt: cacheData.cachedAt,
    };
  }

  /**
   * Retrieve all parts for a PDF
   */
  async getAllParts(pdfId: string): Promise<
    Array<{
      partNumber: number;
      content: string;
      metadata?: any;
      cachedAt: Date;
    }>
  > {
    const pdfCache = this.cache.get(pdfId);

    if (!pdfCache) {
      logger.debug(`PDF cache not found for PDF ${pdfId}`);
      return [];
    }

    const parts: Array<{
      partNumber: number;
      content: string;
      metadata?: any;
      cachedAt: Date;
    }> = [];

    for (const [partNumber, cacheData] of pdfCache.entries()) {
      parts.push({
        partNumber,
        content: cacheData.content,
        metadata: cacheData.metadata,
        cachedAt: cacheData.cachedAt,
      });
    }

    // Sort by part number
    parts.sort((a, b) => a.partNumber - b.partNumber);

    logger.debug(`Retrieved ${parts.length} parts from cache for PDF ${pdfId}`);
    return parts;
  }

  /**
   * Check if a part exists in the cache
   */
  async hasPart(pdfId: string, partNumber: number): Promise<boolean> {
    const pdfCache = this.cache.get(pdfId);

    if (!pdfCache) {
      return false;
    }

    return pdfCache.has(partNumber);
  }

  /**
   * Remove a part from the cache
   */
  async removePart(pdfId: string, partNumber: number): Promise<boolean> {
    const pdfCache = this.cache.get(pdfId);

    if (!pdfCache) {
      logger.debug(`PDF cache not found for PDF ${pdfId}`);
      return false;
    }

    const result = pdfCache.delete(partNumber);

    if (result) {
      logger.debug(`Removed part ${partNumber} from cache for PDF ${pdfId}`);

      // If no more parts for this PDF, remove the PDF entry
      if (pdfCache.size === 0) {
        this.cache.delete(pdfId);
        logger.debug(`Removed empty PDF cache for ${pdfId}`);
      }
    }

    return result;
  }

  /**
   * Remove all parts for a PDF
   */
  async removeAllParts(pdfId: string): Promise<number> {
    const pdfCache = this.cache.get(pdfId);

    if (!pdfCache) {
      logger.debug(`PDF cache not found for PDF ${pdfId}`);
      return 0;
    }

    const count = pdfCache.size;
    this.cache.delete(pdfId);

    logger.info(`Removed all ${count} parts from cache for PDF ${pdfId}`);
    return count;
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    totalCachedParts: number;
    totalCachedPdfs: number;
    cacheSize: number;
  }> {
    let totalCachedParts = 0;
    let totalCachedPdfs = 0;

    for (const pdfCache of this.cache.values()) {
      totalCachedParts += pdfCache.size;
      totalCachedPdfs++;
    }

    const cacheSize = totalCachedParts;

    return {
      totalCachedParts,
      totalCachedPdfs,
      cacheSize,
    };
  }

  /**
   * Clear the entire cache
   */
  async clear(): Promise<boolean> {
    const totalParts = (await this.getStats()).totalCachedParts;

    this.cache.clear();

    logger.info(`Cleared entire cache, removed ${totalParts} parts`);
    return true;
  }
}
