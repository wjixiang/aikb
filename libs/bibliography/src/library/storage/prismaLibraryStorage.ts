import { AbstractPdf, ILibraryStorage } from '../storage';
import {
  ItemMetadata,
  ItemArchive,
  SearchFilter,
  Collection,
  Citation,
  Author,
} from '../types';
import { PrismaClient } from 'bibliography-db';
import { S3Service, S3ServiceConfig } from '@aikb/s3-service';
import { GetObjectCommand } from '@aws-sdk/client-s3';

export class PrismaLibraryStorage implements ILibraryStorage {
  private prisma: PrismaClient;
  private s3Service: S3Service;

  constructor(prisma: PrismaClient, s3ServiceConfig: S3ServiceConfig) {
    this.prisma = prisma;
    this.s3Service = new S3Service(s3ServiceConfig);
  }

  // Helper methods for data transformation
  private mapPrismaItemToItemMetadata(item: any): ItemMetadata {
    return {
      id: item.id,
      title: item.title,
      authors:
        item.item_authors?.map((ia) => ({
          firstName: ia.authors.first_name,
          lastName: ia.authors.last_name,
          middleName: ia.authors.middle_name || undefined,
        })) || [],
      abstract: item.abstract || undefined,
      publicationYear: item.publication_year || undefined,
      publisher: item.publisher || undefined,
      isbn: item.isbn || undefined,
      doi: item.doi || undefined,
      url: item.url || undefined,
      tags: item.tags,
      notes: item.notes || undefined,
      collections: item.item_collections?.map((ic) => ic.collections.id) || [],
      dateAdded: item.date_added,
      dateModified: item.date_modified,
      language: item.language || undefined,
      markdownContent:
        item.markdowns?.content || item.markdown_content || undefined,
      markdownUpdatedDate:
        item.markdowns?.date_modified ||
        item.markdown_updated_date ||
        undefined,
      archives:
        item.item_archives?.map((ia) => ({
          fileType: ia.file_type as any,
          fileSize: ia.file_size,
          fileHash: ia.file_hash,
          addDate: ia.add_date,
          s3Key: ia.s3_key,
          pageCount: ia.page_count,
          wordCount: ia.word_count || undefined,
        })) || [],
    };
  }

  private mapPrismaCollectionToCollection(collection: any): Collection {
    return {
      id: collection.id,
      name: collection.name,
      description: collection.description || undefined,
      parentCollectionId: collection.parent_collection_id || undefined,
      dateAdded: collection.date_added,
      dateModified: collection.date_modified,
    };
  }

  private mapPrismaCitationToCitation(citation: any): Citation {
    return {
      id: citation.id,
      itemId: citation.item_id,
      citationStyle: citation.citation_style,
      citationText: citation.citation_text,
      dateGenerated: citation.date_generated,
    };
  }

  // PDF operations
  async uploadPdf(pdfData: Buffer, fileName: string): Promise<AbstractPdf> {
    const result = await this.s3Service.uploadToS3(pdfData, fileName, {
      contentType: 'application/pdf',
    });

    return {
      id: result.key,
      name: fileName,
      s3Key: result.key,
      url: result.url,
      fileSize: pdfData.length,
      createDate: new Date(),
    };
  }

  async getPdfDownloadUrl(s3Key: string): Promise<string> {
    return await this.s3Service.getSignedDownloadUrl(s3Key);
  }

  async getPdf(s3Key: string): Promise<Buffer> {
    const command = new GetObjectCommand({
      Bucket: this.s3Service.getBucketName(),
      Key: s3Key,
    });

    const response = await (this.s3Service as any)['s3Client'].send(command);
    const chunks: Buffer[] = [];

    for await (const chunk of response.Body as any) {
      chunks.push(chunk);
    }

    return Buffer.concat(chunks);
  }

  // Metadata operations
  async saveMetadata(
    metadata: ItemMetadata,
  ): Promise<ItemMetadata & { id: string }> {
    const { authors, collections, ...itemData } = metadata;

    const createdItem = await this.prisma.items.create({
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
        language: itemData.language,
        markdown_content: itemData.markdownContent,
        markdown_updated_date: itemData.markdownUpdatedDate,
        date_added: itemData.dateAdded,
        date_modified: itemData.dateModified,
      },
    });

    // Create authors
    if (authors && authors.length > 0) {
      for (const author of authors) {
        // Find or create author
        const existingAuthor = await this.prisma.authors.findFirst({
          where: {
            first_name: author.firstName,
            last_name: author.lastName,
          },
        });

        const authorRecord =
          existingAuthor ||
          (await this.prisma.authors.create({
            data: {
              first_name: author.firstName,
              last_name: author.lastName,
              middle_name: author.middleName,
            },
          }));

        // Create relationship
        await this.prisma.item_authors.create({
          data: {
            item_id: createdItem.id,
            author_id: authorRecord.id,
          },
        });
      }
    }

    // Create collections
    if (collections && collections.length > 0) {
      for (const collectionId of collections) {
        await this.prisma.item_collections.create({
          data: {
            item_id: createdItem.id,
            collection_id: collectionId,
          },
        });
      }
    }

    // Fetch the complete item with relationships
    const completeItem = await this.prisma.items.findUnique({
      where: { id: createdItem.id },
      include: {
        item_authors: { include: { authors: true } },
        item_archives: true,
        item_collections: { include: { collections: true } },
        markdowns: true,
      },
    });

    if (!completeItem) {
      throw new Error('Failed to retrieve created item');
    }

    const result = this.mapPrismaItemToItemMetadata(completeItem);
    return result as ItemMetadata & { id: string };
  }

  async getMetadata(id: string): Promise<ItemMetadata | null> {
    const item = await this.prisma.items.findUnique({
      where: { id },
      include: {
        item_authors: { include: { authors: true } },
        item_archives: true,
        item_collections: { include: { collections: true } },
        markdowns: true,
      },
    });

    return item ? this.mapPrismaItemToItemMetadata(item) : null;
  }

  async getMetadataByHash(contentHash: string): Promise<ItemMetadata | null> {
    const itemArchive = await this.prisma.item_archives.findFirst({
      where: { file_hash: contentHash },
      include: {
        items: {
          include: {
            item_authors: { include: { authors: true } },
            item_archives: true,
            item_collections: { include: { collections: true } },
            markdowns: true,
          },
        },
      },
    });

    return itemArchive?.items
      ? this.mapPrismaItemToItemMetadata(itemArchive.items)
      : null;
  }

  async updateMetadata(metadata: ItemMetadata): Promise<void> {
    const { id, authors, collections, archives, ...itemData } = metadata;

    // Update the main item
    await this.prisma.items.update({
      where: { id: id! },
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
        language: itemData.language,
        markdown_content: itemData.markdownContent,
        markdown_updated_date: itemData.markdownUpdatedDate,
        date_modified: new Date(),
      },
    });

    // Update authors
    if (authors) {
      // Delete existing author relationships
      await this.prisma.item_authors.deleteMany({
        where: { item_id: id! },
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

        const authorRecord =
          existingAuthor ||
          (await this.prisma.authors.create({
            data: {
              first_name: author.firstName,
              last_name: author.lastName,
              middle_name: author.middleName,
            },
          }));

        // Create relationship
        await this.prisma.item_authors.create({
          data: {
            item_id: id!,
            author_id: authorRecord.id,
          },
        });
      }
    }

    // Update collections
    if (collections) {
      // Remove existing collections
      await this.prisma.item_collections.deleteMany({
        where: { item_id: id! },
      });

      // Add new collections
      if (collections.length > 0) {
        await this.prisma.item_collections.createMany({
          data: collections.map((collectionId) => ({
            item_id: id!,
            collection_id: collectionId,
          })),
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

  async searchMetadata(filter: SearchFilter): Promise<ItemMetadata[]> {
    const whereClause: any = {};

    if (filter.query) {
      whereClause.OR = [
        { title: { contains: filter.query, mode: 'insensitive' } },
        { abstract: { contains: filter.query, mode: 'insensitive' } },
        { notes: { contains: filter.query, mode: 'insensitive' } },
      ];
    }

    if (filter.tags && filter.tags.length > 0) {
      whereClause.tags = { hasSome: filter.tags };
    }

    if (filter.collections && filter.collections.length > 0) {
      whereClause.item_collections = {
        some: {
          collection_id: { in: filter.collections },
        },
      };
    }

    if (filter.authors && filter.authors.length > 0) {
      whereClause.item_authors = {
        some: {
          authors: {
            OR: filter.authors.map((author) => ({
              OR: [
                { first_name: { contains: author, mode: 'insensitive' } },
                { last_name: { contains: author, mode: 'insensitive' } },
              ],
            })),
          },
        },
      };
    }

    if (filter.dateRange) {
      whereClause.date_added = {
        gte: filter.dateRange.start,
        lte: filter.dateRange.end,
      };
    }

    const items = await this.prisma.items.findMany({
      where: whereClause,
      include: {
        item_authors: { include: { authors: true } },
        item_archives: true,
        item_collections: { include: { collections: true } },
        markdowns: true,
      },
    });

    return items.map((item) => this.mapPrismaItemToItemMetadata(item));
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

  // Collection operations
  async saveCollection(collection: Collection): Promise<Collection> {
    const createdCollection = await this.prisma.collections.upsert({
      where: { id: collection.id || '' },
      update: {
        name: collection.name,
        description: collection.description,
        parent_collection_id: collection.parentCollectionId,
        date_modified: new Date(),
      },
      create: {
        name: collection.name,
        description: collection.description,
        parent_collection_id: collection.parentCollectionId,
        date_added: collection.dateAdded,
        date_modified: collection.dateModified,
      },
    });

    return this.mapPrismaCollectionToCollection(createdCollection);
  }

  async getCollections(): Promise<Collection[]> {
    const collections = await this.prisma.collections.findMany({
      orderBy: { name: 'asc' },
    });

    return collections.map((collection) =>
      this.mapPrismaCollectionToCollection(collection),
    );
  }

  async addItemToCollection(
    itemId: string,
    collectionId: string,
  ): Promise<void> {
    await this.prisma.item_collections.create({
      data: {
        item_id: itemId,
        collection_id: collectionId,
      },
    });
  }

  async removeItemFromCollection(
    itemId: string,
    collectionId: string,
  ): Promise<void> {
    await this.prisma.item_collections.deleteMany({
      where: {
        item_id: itemId,
        collection_id: collectionId,
      },
    });
  }

  async deleteCollection(id: string): Promise<boolean> {
    try {
      await this.prisma.collections.delete({
        where: { id },
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  // Citation operations
  async saveCitation(citation: Citation): Promise<Citation> {
    const createdCitation = await this.prisma.citations.create({
      data: {
        item_id: citation.itemId,
        citation_style: citation.citationStyle,
        citation_text: citation.citationText,
        date_generated: citation.dateGenerated,
      },
    });

    return this.mapPrismaCitationToCitation(createdCitation);
  }

  async getCitations(itemId: string): Promise<Citation[]> {
    const citations = await this.prisma.citations.findMany({
      where: { item_id: itemId },
      orderBy: { date_generated: 'desc' },
    });

    return citations.map((citation) =>
      this.mapPrismaCitationToCitation(citation),
    );
  }

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

    // Also update the item's markdown_content and markdown_updated_date
    await this.prisma.items.update({
      where: { id: itemId },
      data: {
        markdown_content: markdownContent,
        markdown_updated_date: new Date(),
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

      // Also clear the item's markdown_content and markdown_updated_date
      await this.prisma.items.update({
        where: { id: itemId },
        data: {
          markdown_content: null,
          markdown_updated_date: null,
        },
      });

      return true;
    } catch (error) {
      return false;
    }
  }
}
