import * as crypto from 'crypto';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { BookMetadata } from './types.js';

/**
 * Utility functions for generating content hashes
 */
export class HashUtils {
  /**
   * Generate SHA-256 hash from file buffer
   */
  static generateHashFromBuffer(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Generate SHA-256 hash from file path
   */
  static async generateHashFromPath(filePath: string): Promise<string> {
    const fileBuffer = fs.readFileSync(filePath);
    return this.generateHashFromBuffer(fileBuffer);
  }

  /**
   * Generate hash from metadata fields (for articles without files)
   */
  static generateHashFromMetadata(metadata: Partial<BookMetadata>): string {
    const hashInput = {
      title: metadata.title || '',
      authors:
        metadata.authors
          ?.map(
            (author) =>
              `${author.lastName},${author.firstName}${author.middleName ? ',' + author.middleName : ''}`,
          )
          .sort()
          .join('|') || '',
      abstract: metadata.abstract || '',
      publicationYear: metadata.publicationYear || 0,
      publisher: metadata.publisher || '',
      doi: metadata.doi || '',
      isbn: metadata.isbn || '',
    };

    const hashString = JSON.stringify(hashInput);
    return crypto.createHash('sha256').update(hashString).digest('hex');
  }
}



/**
 * Utility functions for formatting citations
 */
export class CitationFormatter {
  /**
   * Helper method to format citation
   */
  static formatCitation(metadata: BookMetadata, style: string): string {
    const authors = metadata.authors
      .map(
        (author) =>
          `${author.lastName}, ${author.firstName}${author.middleName ? ' ' + author.middleName[0] + '.' : ''}`,
      )
      .join(', ');

    switch (style.toLowerCase()) {
      case 'apa':
        return `${authors} (${metadata.publicationYear}). ${metadata.title}. ${metadata.publisher || ''}.`;
      case 'mla':
        return `${authors}. "${metadata.title}." ${metadata.publisher || ''}, ${metadata.publicationYear}.`;
      case 'chicago':
        return `${authors}. ${metadata.title}. ${metadata.publisher || ''}, ${metadata.publicationYear}.`;
      default:
        return `${authors}. ${metadata.title}. ${metadata.publicationYear}.`;
    }
  }
}
