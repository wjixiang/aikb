/**
 * Markdown part cache interface
 * Manages caching of markdown parts during PDF conversion process
 */
export interface IMarkdownPartCache {
  /**
   * Store a markdown part in the cache
   * @param pdfId - Unique identifier for the PDF
   * @param partNumber - Part number
   * @param markdownContent - Markdown content to cache
   * @param metadata - Optional metadata about the part
   * @returns Promise resolving to success status
   */
  storePart(
    pdfId: string,
    partNumber: number,
    markdownContent: string,
    metadata?: any
  ): Promise<boolean>;

  /**
   * Retrieve a markdown part from the cache
   * @param pdfId - Unique identifier for the PDF
   * @param partNumber - Part number
   * @returns Promise resolving to cached content or null if not found
   */
  getPart(pdfId: string, partNumber: number): Promise<{
    content: string;
    metadata?: any;
    cachedAt: Date;
  } | null>;

  /**
   * Retrieve all parts for a PDF
   * @param pdfId - Unique identifier for the PDF
   * @returns Promise resolving to array of all cached parts
   */
  getAllParts(pdfId: string): Promise<Array<{
    partNumber: number;
    content: string;
    metadata?: any;
    cachedAt: Date;
  }>>;

  /**
   * Check if a part exists in the cache
   * @param pdfId - Unique identifier for the PDF
   * @param partNumber - Part number
   * @returns Promise resolving to existence status
   */
  hasPart(pdfId: string, partNumber: number): Promise<boolean>;

  /**
   * Remove a part from the cache
   * @param pdfId - Unique identifier for the PDF
   * @param partNumber - Part number
   * @returns Promise resolving to success status
   */
  removePart(pdfId: string, partNumber: number): Promise<boolean>;

  /**
   * Remove all parts for a PDF
   * @param pdfId - Unique identifier for the PDF
   * @returns Promise resolving to number of removed parts
   */
  removeAllParts(pdfId: string): Promise<number>;

  /**
   * Get cache statistics
   * @returns Promise resolving to cache statistics
   */
  getStats(): Promise<{
    totalCachedParts: number;
    totalCachedPdfs: number;
    cacheSize: number;
  }>;

  /**
   * Clear the entire cache
   * @returns Promise resolving to success status
   */
  clear(): Promise<boolean>;
}

/**
 * Markdown part cache data structure
 */
export interface MarkdownPartCacheData {
  pdfId: string;
  partNumber: number;
  content: string;
  metadata?: any;
  cachedAt: Date;
  updatedAt: Date;
}