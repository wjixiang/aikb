import { PrismaClient } from 'bibliography-db';
import { IItemStorage } from './item-storage.js';
import { ItemMetadata, ItemArchive } from '../library/types.js';

/**
 * Prisma implementation of IItemStorage
 * This class uses Prisma Client to interact with the database
 */
export class PrismaItemStorage implements IItemStorage {
  constructor(private prisma: PrismaClient) {}

  // PDF operations
  async getPdfDownloadUrl(s3Key: string): Promise<string> {
    // This method would typically generate a presigned URL for S3
    // For now, we'll return a mock URL
    return `https://s3.amazonaws.com/bucket/${s3Key}`;
  }

  async getPdf(s3Key: string): Promise<Buffer> {
    // This method would typically fetch the PDF from S3
    // For now, we'll return a mock PDF buffer
    throw new Error('PDF retrieval not implemented in PrismaItemStorage');
  }

  // Metadata operations
  async getMetadata(id: string): Promise<ItemMetadata | null> {
    const item = await this.prisma.items.findUnique({
      where: { id },
      include: {
        item_archives: true,
        item_authors: {
          include: {
            authors: true,
          },
        },
        item_collections: {
          include: {
            collections: true,
          },
        },
      },
    });

    if (!item) {
      return null;
    }

    return this.mapPrismaItemToItemMetadata(item);
  }

  async updateMetadata(metadata: ItemMetadata): Promise<void> {
    const { id, authors, archives, collections, ...itemData } = metadata;

    if (!id) {
      throw new Error('Item ID is required for update');
    }

    // Update the main item
    await this.prisma.items.update({
      where: { id },
      data: {
        title: itemData.title,
        abstract: itemData.abstract,
        publication_year: itemData.publicationYear,
        publisher: itemData.publisher,
        isbn: itemData.isbn,
        doi: itemData.doi,
        url: itemData.url,
        tags: itemData.tags,
        notes: itemData.notes,
        date_modified: itemData.dateModified,
        language: itemData.language,
        markdown_content: itemData.markdownContent,
        markdown_updated_date: itemData.markdownUpdatedDate,
      },
    });

    // Update authors
    if (authors) {
      // Delete existing author relationships
      await this.prisma.item_authors.deleteMany({
        where: { item_id: id },
      });

      // Create new author relationships
      for (const author of authors) {
        // Find or create author
        const existingAuthor = await this.prisma.authors.findFirst({
          where: {
            first_name: author.firstName,
            last_name: author.lastName,
          },
        });

        const authorRecord = existingAuthor || await this.prisma.authors.create({
          data: {
            first_name: author.firstName,
            last_name: author.lastName,
            middle_name: author.middleName,
          },
        });

        // Create relationship
        await this.prisma.item_authors.create({
          data: {
            item_id: id,
            author_id: authorRecord.id,
          },
        });
      }
    }

    // Update collections
    if (collections) {
      // Delete existing collection relationships
      await this.prisma.item_collections.deleteMany({
        where: { item_id: id },
      });

      // Create new collection relationships
      for (const collectionId of collections) {
        await this.prisma.item_collections.create({
          data: {
            item_id: id,
            collection_id: collectionId,
          },
        });
      }
    }
  }

  async addArchiveToMetadata(id: string, archive: ItemArchive): Promise<void> {
    await this.prisma.item_archives.create({
      data: {
        item_id: id,
        file_type: archive.fileType,
        file_size: archive.fileSize,
        file_hash: archive.fileHash,
        add_date: archive.addDate,
        s3_key: archive.s3Key,
        page_count: archive.pageCount,
        word_count: archive.wordCount,
      },
    });
  }

  async deleteMetadata(id: string): Promise<boolean> {
    try {
      await this.prisma.items.delete({
        where: { id },
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  // Citation operations
  async deleteCitations(itemId: string): Promise<boolean> {
    try {
      await this.prisma.citations.deleteMany({
        where: { item_id: itemId },
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  // Markdown operations
  async saveMarkdown(itemId: string, markdownContent: string): Promise<void> {
    await this.prisma.markdowns.upsert({
      where: { item_id: itemId },
      update: {
        content: markdownContent,
        date_modified: new Date(),
      },
      create: {
        item_id: itemId,
        content: markdownContent,
      },
    });
  }

  async getMarkdown(itemId: string): Promise<string | null> {
    const markdown = await this.prisma.markdowns.findUnique({
      where: { item_id: itemId },
    });

    return markdown?.content || null;
  }

  async deleteMarkdown(itemId: string): Promise<boolean> {
    try {
      await this.prisma.markdowns.delete({
        where: { item_id: itemId },
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Helper method to map Prisma item to ItemMetadata
   */
  private mapPrismaItemToItemMetadata(item: any): ItemMetadata {
    return {
      id: item.id,
      title: item.title,
      abstract: item.abstract,
      publicationYear: item.publication_year,
      publisher: item.publisher,
      isbn: item.isbn,
      doi: item.doi,
      url: item.url,
      tags: item.tags,
      notes: item.notes,
      dateAdded: item.date_added,
      dateModified: item.date_modified,
      language: item.language,
      markdownContent: item.markdown_content,
      markdownUpdatedDate: item.markdown_updated_date,
      authors: item.item_authors.map((ia: any) => ({
        firstName: ia.authors.first_name,
        lastName: ia.authors.last_name,
        middleName: ia.authors.middle_name,
      })),
      collections: item.item_collections.map((ic: any) => ic.collection_id),
      archives: item.item_archives.map((archive: any) => ({
        fileType: archive.file_type,
        fileSize: archive.file_size,
        fileHash: archive.file_hash,
        addDate: archive.add_date,
        s3Key: archive.s3_key,
        pageCount: archive.page_count,
        wordCount: archive.word_count,
      })),
    };
  }
}