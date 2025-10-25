import { createLoggerWithPrefix } from '@aikb/log-management';
import { deleteFromS3 } from '@aikb/s3-service';
import { v4 } from 'uuid';
import { AbstractLibraryStorage } from '../library/storage.js';
import { BookMetadata, ItemChunk } from '../library/types.js';

const logger = createLoggerWithPrefix('LibraryItem');

export class LibraryItem {
  constructor(
    public metadata: BookMetadata,
    private storage: AbstractLibraryStorage,
  ) {}

  /**
   * Get the ID of this library item
   */
  getItemId(): string {
    if (!this.metadata.id) {
      throw new Error('Library item does not have an ID');
    }
    return this.metadata.id;
  }

  /**
   * Check if this item has an associated PDF file
   */
  hasPdf(): boolean {
    return !!this.metadata.s3Key;
  }

  /**
   * Get the PDF file if available
   */
  async getPdf(): Promise<Buffer | null> {
    if (!this.metadata.s3Key) {
      throw new Error('No PDF file associated with this item');
    }
    return await this.storage.getPdf(this.metadata.s3Key);
  }

  /**
   * Get the PDF download URL if available
   */
  async getPdfDownloadUrl(): Promise<string> {
    if (!this.metadata.s3Key) {
      throw new Error('No PDF file associated with this item');
    }
    return await this.storage.getPdfDownloadUrl(this.metadata.s3Key);
  }

  /**
   * Get markdown representation of the item
   */
  async getMarkdown(): Promise<string> {
    // First try to get stored markdown content
    const storedMarkdown = await this.storage.getMarkdown(this.metadata.id!);
    if (storedMarkdown) {
      return storedMarkdown;
    }

    // If no stored markdown, return a placeholder
    return `# ${this.metadata.title}\n\n${this.metadata.abstract || ''}`;
  }

  /**
   * Update the metadata of this item
   */
  async updateMetadata(updates: Partial<BookMetadata>): Promise<void> {
    this.metadata = { ...this.metadata, ...updates, dateModified: new Date() };
    await this.storage.updateMetadata(this.metadata);
  }

  /**
   * Add a tag to this item
   */
  async addTag(tag: string): Promise<void> {
    if (!this.metadata.tags.includes(tag)) {
      this.metadata.tags.push(tag);
      await this.updateMetadata({ tags: this.metadata.tags });
    }
  }

  /**
   * Remove a tag from this item
   */
  async removeTag(tag: string): Promise<void> {
    const index = this.metadata.tags.indexOf(tag);
    if (index > -1) {
      this.metadata.tags.splice(index, 1);
      await this.updateMetadata({ tags: this.metadata.tags });
    }
  }

  /**
   * Add this item to a collection
   */
  async addToCollection(collectionId: string): Promise<void> {
    if (!this.metadata.collections.includes(collectionId)) {
      this.metadata.collections.push(collectionId);
      await this.updateMetadata({ collections: this.metadata.collections });
    }
  }

  /**
   * Remove this item from a collection
   */
  async removeFromCollection(collectionId: string): Promise<void> {
    const index = this.metadata.collections.indexOf(collectionId);
    if (index > -1) {
      this.metadata.collections.splice(index, 1);
      await this.updateMetadata({ collections: this.metadata.collections });
    }
  }

  /**
   * Extract markdown from PDF - simplified version
   */
  async extractMarkdown(): Promise<void> {
    logger.info(
      `[LibraryItem.extractMarkdown] Starting markdown extraction for item: ${this.metadata.id}`,
    );

    // Check if this item has an associated PDF file
    if (!this.hasPdf()) {
      throw new Error('No PDF file associated with this item');
    }

    try {
      logger.info(`[LibraryItem.extractMarkdown] Getting PDF download URL...`);
      // Get the PDF download URL
      const pdfUrl = await this.getPdfDownloadUrl();
      logger.info(`[LibraryItem.extractMarkdown] PDF URL obtained: ${pdfUrl}`);

      // For now, just create a simple placeholder markdown
      // In a full implementation, you would use MinerUPdfConvertor here
      const markdownContent = `# ${this.metadata.title}\n\n*Authors:* ${this.metadata.authors.map(a => `${a.firstName} ${a.lastName}`).join(', ')}\n\n*Publication Year:* ${this.metadata.publicationYear || 'Unknown'}\n\n## Abstract\n\n${this.metadata.abstract || 'No abstract available.'}\n\n## Content\n\n[PDF content would be extracted here using MinerUPdfConvertor]`;

      // Save the markdown content to storage
      await this.storage.saveMarkdown(this.metadata.id!, markdownContent);

      // Update the metadata with the markdown content and timestamp
      await this.updateMetadata({
        markdownContent,
        markdownUpdatedDate: new Date(),
      });

      logger.info(
        `Successfully extracted and saved markdown for item: ${this.metadata.id}`,
      );
    } catch (error) {
      logger.error(
        `Error extracting markdown for item ${this.metadata.id}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get all chunks for this item
   */
  async getChunks(): Promise<ItemChunk[]> {
    const chunks = await this.storage.getChunksByItemId(this.metadata.id!);
    logger.info(
      `Retrieved ${chunks.length} chunks for item: ${this.metadata.id}`,
    );
    return chunks;
  }

  /**
   * Delete all chunks for this item
   */
  async deleteChunks(): Promise<number> {
    return await this.storage.deleteChunksByItemId(this.metadata.id!);
  }

  /**
   * Delete this item and all associated data
   */
  async selfDelete(): Promise<boolean> {
    const logger = createLoggerWithPrefix('LibraryItem.selfDelete');
    try {
      logger.info(`Starting self-delete for item: ${this.metadata.id}`);

      if (!this.metadata.id) {
        throw new Error('Cannot delete item without ID');
      }

      // Step 1: Delete all chunks and embeddings
      logger.info(`Deleting chunks for item: ${this.metadata.id}`);
      const deletedChunksCount = await this.deleteChunks();
      logger.info(
        `Deleted ${deletedChunksCount} chunks for item: ${this.metadata.id}`,
      );

      // Step 2: Delete citations
      logger.info(`Deleting citations for item: ${this.metadata.id}`);
      await this.storage.deleteCitations(this.metadata.id);
      logger.info(`Deleted citations for item: ${this.metadata.id}`);

      // Step 3: Delete markdown content
      logger.info(`Deleting markdown content for item: ${this.metadata.id}`);
      await this.storage.deleteMarkdown(this.metadata.id);
      logger.info(`Deleted markdown content for item: ${this.metadata.id}`);

      // Step 4: Delete PDF file from S3 if it exists
      if (this.metadata.s3Key) {
        logger.info(`Deleting PDF file from S3: ${this.metadata.s3Key}`);
        try {
          await deleteFromS3(this.metadata.s3Key);
          logger.info(`Deleted PDF file from S3: ${this.metadata.s3Key}`);
        } catch (error) {
          logger.error(
            `Failed to delete PDF file from S3: ${this.metadata.s3Key}`,
            error,
          );
          // Continue with other deletions even if S3 deletion fails
        }
      }

      // Step 5: Delete metadata (this should be the last step)
      logger.info(`Deleting metadata for item: ${this.metadata.id}`);
      const metadataDeleted = await this.storage.deleteMetadata(this.metadata.id);

      if (metadataDeleted) {
        logger.info(
          `Successfully deleted all data for item: ${this.metadata.id}`,
        );
        return true;
      } else {
        logger.warn(`Failed to delete metadata for item: ${this.metadata.id}`);
        return false;
      }
    } catch (error) {
      logger.error(
        `Error in selfDelete for item ${this.metadata.id}:`,
        error,
      );
      throw error;
    }
  }
}