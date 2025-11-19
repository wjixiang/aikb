import { v4 } from 'uuid';
import { nanoid } from 'nanoid';



/**
 * Utility functions for generating IDs without database dependency
 */
export class IdUtils {
  /**
   * Generate a unique ID using uuidv4
   */
  static generateId(): string {
    return v4();
  }

  /**
   * Generate a UUID using uuidv4
   */
  static generateUUID(): string {
    return v4();
  }

  /**
   * Generate a unique chunk ID based on item ID and chunk index
   * Format: chunk-{itemId}-{chunkIndex}-{shortId}
   * @param itemId The parent item ID
   * @param chunkIndex The index of the chunk within the item
   * @returns A unique chunk identifier
   */
  static generateChunkId(itemId: string, chunkIndex: number): string {
    const shortId = nanoid(6); // Generate 6-character short ID for uniqueness
    return `chunk-${itemId}-${chunkIndex}-${shortId}`;
  }
}

/**
 * Utility functions for S3 operations
 */
export class S3Utils {
  /**
   * Generate a standardized S3 key for PDF files
   * Format: library/pdfs/{year}/{month}/{date}/{timestamp}-{filename}
   * @param fileName The name of the PDF file
   * @returns The generated S3 key
   */
  static generatePdfS3Key(fileName: string): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const date = String(now.getDate()).padStart(2, '0');
    const timestamp = Date.now();
    return `library/pdfs/${year}/${month}/${date}/${timestamp}-${fileName}`;
  }
}
