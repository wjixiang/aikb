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
