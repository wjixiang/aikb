import { v4 } from 'uuid';

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
}

/**
 * Utility functions for S3 operations
 */
export class S3Utils {
  /**
   * Generate a standardized S3 key for PDF files
   * Format: library/pdfs/{year}/{timestamp}-{filename}
   * @param fileName The name of the PDF file
   * @returns The generated S3 key
   */
  static generatePdfS3Key(fileName: string): string {
    const year = new Date().getFullYear();
    const timestamp = Date.now();
    return `library/pdfs/${year}/${timestamp}-${fileName}`;
  }
}
