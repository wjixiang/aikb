import { createLoggerWithPrefix } from 'log-management';
import { v4 } from 'uuid';
import { IItemStorage } from './item-storage.js';
import { ItemArchive, ItemMetadata } from '../library/types.js';

const logger = createLoggerWithPrefix('LibraryItem');

export class LibraryItem {
  constructor(
    public metadata: ItemMetadata,
    private storage: IItemStorage,
  ) {}

  /**
   * Custom JSON serialization to avoid circular references
   */
  toJSON() {
    // Return only the metadata, excluding the storage property which contains circular references
    return {
      metadata: this.metadata,
    };
  }

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
   * Get the PDF download URL if available
   */
  async getPdfDownloadUrl(): Promise<string> {
    if (this.metadata.archives.length === 0) {
      throw new Error('No PDF file associated with this item');
    }
    return await this.storage.getPdfDownloadUrl(
      this.metadata.archives[0].s3Key,
    );
  }

  /**
   * Get markdown representation of the item
   */
  async getMarkdown(): Promise<string | null> {
    // First try to get stored markdown content
    const storedMarkdown = await this.storage.getMarkdown(this.metadata.id!);
    if (storedMarkdown) {
      return storedMarkdown;
    }

    // If no stored markdown, return a placeholder
    return null;
  }

  /**
   * Update the metadata of this item
   */
  async updateMetadata(updates: Partial<ItemMetadata>): Promise<void> {
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

    try {
      logger.info(`[LibraryItem.extractMarkdown] Getting PDF download URL...`);
      // Get the PDF download URL
      const pdfUrl = await this.getPdfDownloadUrl();
      logger.info(`[LibraryItem.extractMarkdown] PDF URL obtained: ${pdfUrl}`);

      // For now, just create a simple placeholder markdown
      // In a full implementation, you would use MinerUPdfConvertor here
      const markdownContent = `# ${this.metadata.title}\n\n*Authors:* ${this.metadata.authors.map((a) => `${a.firstName} ${a.lastName}`).join(', ')}\n\n*Publication Year:* ${this.metadata.publicationYear || 'Unknown'}\n\n## Abstract\n\n${this.metadata.abstract || 'No abstract available.'}\n\n## Content\n\n[PDF content would be extracted here using MinerUPdfConvertor]`;

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
      // const deletedChunksCount = await this.deleteChunks();
      // logger.info(
      //   `Deleted ${deletedChunksCount} chunks for item: ${this.metadata.id}`,
      // );

      // Step 2: Delete citations
      logger.info(`Deleting citations for item: ${this.metadata.id}`);
      await this.storage.deleteCitations(this.metadata.id);
      logger.info(`Deleted citations for item: ${this.metadata.id}`);

      // Step 3: Delete markdown content
      logger.info(`Deleting markdown content for item: ${this.metadata.id}`);
      await this.storage.deleteMarkdown(this.metadata.id);
      logger.info(`Deleted markdown content for item: ${this.metadata.id}`);

      // Step 4: Delete PDF files from S3 if they exist
      for (const archive of this.metadata.archives) {
        try {
          logger.info(`Deleting PDF file from S3: ${archive.s3Key}`);
          const { deleteFromS3 } = await import('@aikb/s3-service');
          await deleteFromS3(archive.s3Key);
          logger.info(`Deleted PDF file from S3: ${archive.s3Key}`);
        } catch (error) {
          logger.error(
            `Failed to delete PDF file from S3: ${archive.s3Key}`,
            error,
          );
          // Continue with other deletions even if S3 deletion fails
        }
      }

      // Step 5: Delete metadata (this should be the last step)
      logger.info(`Deleting metadata for item: ${this.metadata.id}`);
      const metadataDeleted = await this.storage.deleteMetadata(
        this.metadata.id,
      );

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
      logger.error(`Error in selfDelete for item ${this.metadata.id}:`, error);
      throw error;
    }
  }

  /**
   * Add an archive to the metadata
   */
  async addArchiveToMetadata(newArchive: ItemArchive): Promise<boolean> {
    try {
      if (!this.metadata.id) {
        throw new Error('Cannot add archive to item without ID');
      }

      // Add the archive to storage (this will update the metadata in storage)
      await this.storage.addArchiveToMetadata(this.metadata.id, newArchive);

      // Refresh the local metadata from storage to get the updated archives
      const updatedMetadata = await this.storage.getMetadata(this.metadata.id);
      if (updatedMetadata) {
        this.metadata = updatedMetadata;
      }

      return true;
    } catch (error) {
      logger.error(
        `Error adding archive to metadata for item ${this.metadata.id}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * List all archives associated with this item
   */
  listArchives(): ItemArchive[] {
    // Return a copy of the archives array to prevent external modifications
    return [...this.metadata.archives];
  }
}
