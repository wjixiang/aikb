import { Client } from '@elastic/elasticsearch';
import { ILibraryStorage, AbstractPdf } from '../library/storage.js';
import { createLoggerWithPrefix } from '@aikb/log-management';
import {
  ItemMetadata,
  Collection,
  Citation,
  SearchFilter,
} from '../library/types.js';
import { IdUtils } from 'utils';
import path from 'path';
import fs from 'fs';
import {
  uploadToS3,
  uploadPdfFromPath,
  getSignedUrlForDownload,
} from '@aikb/s3-service';

export class S3ElasticSearchLibraryStorage implements ILibraryStorage {
  private readonly metadataIndexName = 'library_metadata';
  private readonly collectionsIndexName = 'library_collections';
  private readonly citationsIndexName = 'library_citations';
  private readonly chunksIndexName = 'library_chunks';
  private client: Client;
  private isInitialized = false;

  logger: any = createLoggerWithPrefix('S3ElasticSearchLibraryStorage');

  constructor(
    elasticsearchUrl: string = 'http://elasticsearch:9200',
  ) {
    this.client = new Client({
      node: elasticsearchUrl,
      auth: {
        apiKey: process.env['ELASTICSEARCH_API_KEY'] || '',
      },
    });


    // Don't initialize indexes in constructor to avoid blocking
    // Initialize lazily when first operation is called
  }

  

  /**
   * Initialize the indexes with proper mappings
   */
  private async ensureIndexes(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Check if Elasticsearch is available
      await this.client.ping();
      // this.logger.info('Connected to Elasticsearch');

      // Initialize metadata index
      const metadataExists = await this.client.indices.exists({
        index: this.metadataIndexName,
      });

      if (!metadataExists) {
        await this.client.indices.create({
          index: this.metadataIndexName,
          mappings: {
            properties: {
              id: { type: 'keyword' },
              title: {
                type: 'text',
                fields: {
                  keyword: { type: 'keyword' },
                },
              },
              authors: {
                type: 'nested',
                properties: {
                  firstName: { type: 'text' },
                  lastName: {
                    type: 'text',
                    fields: { keyword: { type: 'keyword' } },
                  },
                  middleName: { type: 'text' },
                },
              },
              abstract: { type: 'text' },
              publicationYear: { type: 'integer' },
              publisher: { type: 'text' },
              isbn: { type: 'keyword' },
              doi: { type: 'keyword' },
              url: { type: 'keyword' },
              tags: { type: 'keyword' },
              notes: { type: 'text' },
              collections: { type: 'keyword' },
              dateAdded: { type: 'date' },
              dateModified: { type: 'date' },
              fileType: { type: 'keyword' },
              s3Key: { type: 'keyword' },
              s3Url: { type: 'keyword' },
              fileSize: { type: 'long' },
              pageCount: { type: 'integer' },
              language: { type: 'keyword' },
              contentHash: { type: 'keyword' },
            },
          },
        } as any);
        this.logger.info(`Created metadata index: ${this.metadataIndexName}`);
      }

      // Initialize collections index
      const collectionsExists = await this.client.indices.exists({
        index: this.collectionsIndexName,
      });

      if (!collectionsExists) {
        await this.client.indices.create({
          index: this.collectionsIndexName,
          mappings: {
            properties: {
              id: { type: 'keyword' },
              name: {
                type: 'text',
                fields: {
                  keyword: { type: 'keyword' },
                },
              },
              description: { type: 'text' },
              parentCollectionId: { type: 'keyword' },
              dateAdded: { type: 'date' },
              dateModified: { type: 'date' },
            },
          },
        } as any);
        this.logger.info(
          `Created collections index: ${this.collectionsIndexName}`,
        );
      }

      // Initialize citations index
      const citationsExists = await this.client.indices.exists({
        index: this.citationsIndexName,
      });

      if (!citationsExists) {
        await this.client.indices.create({
          index: this.citationsIndexName,
          mappings: {
            properties: {
              id: { type: 'keyword' },
              itemId: { type: 'keyword' },
              citationStyle: { type: 'keyword' },
              citationText: { type: 'text' },
              dateGenerated: { type: 'date' },
            },
          },
        } as any);
        this.logger.info(`Created citations index: ${this.citationsIndexName}`);
      }


    } catch (error: any) {
      if (
        (error as any)?.meta?.body?.error?.type ===
        'resource_already_exists_exception'
      ) {
        this.logger.info('Indexes already exist, continuing');
        this.isInitialized = true;
        return;
      }
      if (error.meta?.statusCode === 0 || error.code === 'ECONNREFUSED') {
        this.logger.error(
          'Elasticsearch is not available. Please ensure Elasticsearch is running.',
        );
        throw new Error(
          'Elasticsearch is not available. Please check your configuration and ensure Elasticsearch is running.',
        );
      }
      this.logger.error('Failed to initialize indexes:', error);
      throw error;
    }
  }

  /**
   * Ensure indexes are initialized before performing operations
   */
  private async checkInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.ensureIndexes();
      this.isInitialized = true;
    }
  }

  async uploadPdf(pdfData: Buffer, fileName: string): Promise<AbstractPdf> {
    const s3Key = `library/pdfs/${new Date().getFullYear()}/${Date.now()}-${fileName}`;
    const url = await uploadToS3(pdfData, s3Key, 'application/pdf');

    const pdfInfo: AbstractPdf = {
      id: IdUtils.generateId(),
      name: fileName,
      s3Key,
      url,
      fileSize: pdfData.length,
      createDate: new Date(),
    };

    return pdfInfo;
  }

  async uploadPdfFromPath(pdfPath: string): Promise<AbstractPdf> {
    const fileName = path.basename(pdfPath);
    const s3Key = `library/pdfs/${new Date().getFullYear()}/${Date.now()}-${fileName}`;
    const url = await uploadPdfFromPath(pdfPath, s3Key);

    const stats = fs.statSync(pdfPath);

    const pdfInfo: AbstractPdf = {
      id: IdUtils.generateId(),
      name: fileName,
      s3Key,
      url,
      fileSize: stats.size,
      createDate: new Date(),
    };

    return pdfInfo;
  }

  async getPdfDownloadUrl(s3Key: string): Promise<string> {
    const url = await getSignedUrlForDownload(
      process.env['PDF_OSS_BUCKET_NAME'] as string,
      s3Key,
    );
    return url;
  }

  async getPdf(s3Key: string): Promise<Buffer> {
    // This would download the PDF from S3
    // For now, throw an error as this is not implemented
    throw new Error('Direct PDF download not implemented');
  }

  async saveMetadata(
    metadata: ItemMetadata,
  ): Promise<ItemMetadata & { id: string }> {
    await this.checkInitialized();

    if (!metadata.id) {
      metadata.id = IdUtils.generateId();
    }

    await this.client.index({
      index: this.metadataIndexName,
      id: metadata.id,
      body: metadata,
      refresh: true, // Refresh index to make document immediately available
    } as any);

    return metadata as ItemMetadata & { id: string };
  }

  async getMetadata(id: string): Promise<ItemMetadata | null> {
    await this.checkInitialized();

    try {
      const result = await this.client.get({
        index: this.metadataIndexName,
        id: id,
      });

      if (result.found) {
        return result._source as ItemMetadata;
      }
      return null;
    } catch (error) {
      if ((error as any)?.meta?.statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  async getMetadataByHash(contentHash: string): Promise<ItemMetadata | null> {
    await this.checkInitialized();

    try {
      const result = await this.client.search({
        index: this.metadataIndexName,
        body: {
          query: {
            term: {
              contentHash: contentHash,
            },
          },
        },
      } as any);

      const hits = result.hits?.hits || [];
      if (hits.length > 0 && hits[0]) {
        return hits[0]._source as ItemMetadata;
      }
      return null;
    } catch (error) {
      if (
        (error as any)?.meta?.body?.error?.type === 'index_not_found_exception'
      ) {
        return null;
      }
      throw error;
    }
  }

  async updateMetadata(metadata: ItemMetadata): Promise<void> {
    await this.checkInitialized();

    await this.client.update({
      index: this.metadataIndexName,
      id: metadata.id!,
      body: {
        doc: metadata,
      },
      refresh: true, // Refresh index to make update immediately available
    } as any);
  }

  async searchMetadata(filter: SearchFilter): Promise<ItemMetadata[]> {
    await this.checkInitialized();

    const query: any = {};

    if (filter.query) {
      query.bool = query.bool || { must: [] };
      query.bool.must.push({
        multi_match: {
          query: filter.query,
          fields: ['title', 'abstract', 'notes'],
          fuzziness: 'AUTO',
        },
      });
    }

    if (filter.tags && filter.tags.length > 0) {
      query.bool = query.bool || { must: [] };
      query.bool.must.push({
        terms: {
          tags: filter.tags,
        },
      });
    }

    if (filter.collections && filter.collections.length > 0) {
      query.bool = query.bool || { must: [] };
      query.bool.must.push({
        terms: {
          collections: filter.collections,
        },
      });
    }

    if (filter.authors && filter.authors.length > 0) {
      query.bool = query.bool || { must: [] };
      query.bool.must.push({
        nested: {
          path: 'authors',
          query: {
            terms: {
              'authors.lastName': filter.authors,
            },
          },
        },
      });
    }

    if (filter.dateRange) {
      query.bool = query.bool || { must: [] };
      query.bool.must.push({
        range: {
          publicationYear: {
            gte: filter.dateRange.start.getFullYear(),
            lte: filter.dateRange.end.getFullYear(),
          },
        },
      });
    }

    if (filter.fileType && filter.fileType.length > 0) {
      query.bool = query.bool || { must: [] };
      query.bool.must.push({
        terms: {
          fileType: filter.fileType,
        },
      });
    }

    // If no filters specified, match all
    if (!query.bool) {
      query.match_all = {};
    }

    try {
      const result = await this.client.search({
        index: this.metadataIndexName,
        body: {
          query,
          size: 10000, // Adjust based on expected results
        },
      } as any);

      const hits = result.hits.hits;
      return hits.map((hit) => hit._source as ItemMetadata);
    } catch (error) {
      if (
        (error as any)?.meta?.body?.error?.type === 'index_not_found_exception'
      ) {
        return [];
      }
      throw error;
    }
  }

  async saveCollection(collection: Collection): Promise<Collection> {
    await this.checkInitialized();

    if (!collection.id) {
      collection.id = IdUtils.generateId();
    }

    await this.client.index({
      index: this.collectionsIndexName,
      id: collection.id,
      body: collection,
      refresh: true, // Refresh index to make collection immediately available
    } as any);

    return collection;
  }

  async getCollections(): Promise<Collection[]> {
    await this.checkInitialized();

    try {
      const result = await this.client.search({
        index: this.collectionsIndexName,
        body: {
          query: {
            match_all: {},
          },
          size: 10000,
        },
      } as any);

      const hits = result.hits.hits;
      return hits.map((hit) => hit._source as Collection);
    } catch (error) {
      if (
        (error as any)?.meta?.body?.error?.type === 'index_not_found_exception'
      ) {
        return [];
      }
      throw error;
    }
  }

  async addItemToCollection(
    itemId: string,
    collectionId: string,
  ): Promise<void> {
    await this.checkInitialized();

    const metadata = await this.getMetadata(itemId);
    if (!metadata) {
      throw new Error(`Item with ID ${itemId} not found`);
    }

    if (!metadata.collections.includes(collectionId)) {
      metadata.collections.push(collectionId);
      await this.updateMetadata(metadata);
    }
  }

  async removeItemFromCollection(
    itemId: string,
    collectionId: string,
  ): Promise<void> {
    await this.checkInitialized();

    const metadata = await this.getMetadata(itemId);
    if (!metadata) {
      throw new Error(`Item with ID ${itemId} not found`);
    }

    const index = metadata.collections.indexOf(collectionId);
    if (index > -1) {
      metadata.collections.splice(index, 1);
      await this.updateMetadata(metadata);
    }
  }

  async saveCitation(citation: Citation): Promise<Citation> {
    await this.checkInitialized();

    await this.client.index({
      index: this.citationsIndexName,
      id: citation.id,
      body: citation,
      refresh: true, // Refresh index to make citation immediately available
    } as any);

    return citation;
  }

  async getCitations(itemId: string): Promise<Citation[]> {
    await this.checkInitialized();

    try {
      const result = await this.client.search({
        index: this.citationsIndexName,
        body: {
          query: {
            term: {
              itemId: itemId,
            },
          },
        },
      } as any);

      const hits = result.hits.hits;
      return hits.map((hit) => hit._source as Citation);
    } catch (error) {
      if (
        (error as any)?.meta?.body?.error?.type === 'index_not_found_exception'
      ) {
        return [];
      }
      throw error;
    }
  }

  async saveMarkdown(itemId: string, markdownContent: string): Promise<void> {
    await this.checkInitialized();

    await this.client.update({
      index: this.metadataIndexName,
      id: itemId,
      body: {
        doc: {
          markdownContent,
          markdownUpdatedDate: new Date(),
        },
      },
      refresh: true, // Refresh index to make update immediately available
    } as any);
  }

  async getMarkdown(itemId: string): Promise<string | null> {
    await this.checkInitialized();

    try {
      const result = await this.client.get({
        index: this.metadataIndexName,
        id: itemId,
        _source: ['markdownContent'],
      });

      if (result.found) {
        const source = result._source as any;
        return source?.markdownContent || null;
      }
      return null;
    } catch (error) {
      if ((error as any)?.meta?.statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  async deleteMarkdown(itemId: string): Promise<boolean> {
    await this.checkInitialized();

    try {
      const result = await this.client.update({
        index: this.metadataIndexName,
        id: itemId,
        body: {
          script: {
            source: `
              ctx._source.remove('markdownContent');
              ctx._source.remove('markdownUpdatedDate');
              ctx._source.dateModified = params.dateModified;
            `,
            params: {
              dateModified: new Date().toISOString(),
            },
          },
        },
        refresh: true,
      } as any);

      return result.result === 'updated';
    } catch (error) {
      if ((error as any)?.meta?.statusCode === 404) {
        return false; // Document not found
      }
      throw error;
    }
  }

  async deleteMetadata(id: string): Promise<boolean> {
    await this.checkInitialized();

    try {
      // Delete the metadata document
      const result = await this.client.delete({
        index: this.metadataIndexName,
        id: id,
        refresh: true, // Refresh index to make deletion immediately available
      } as any);

      // Also delete associated citations
      await this.deleteCitations(id);

      return result.result === 'deleted';
    } catch (error) {
      if ((error as any)?.meta?.statusCode === 404) {
        return false; // Document not found
      }
      throw error;
    }
  }

  async deleteCollection(id: string): Promise<boolean> {
    await this.checkInitialized();

    try {
      // First, remove this collection from all items
      const searchResult = await this.client.search({
        index: this.metadataIndexName,
        body: {
          query: {
            term: {
              collections: id,
            },
          },
          size: 10000, // Adjust based on expected number of items
        },
      } as any);

      // Update each item to remove the collection
      for (const hit of searchResult.hits.hits) {
        const metadata = hit._source as ItemMetadata;
        const index = metadata.collections.indexOf(id);
        if (index > -1) {
          metadata.collections.splice(index, 1);
          await this.updateMetadata(metadata);
        }
      }

      // Then delete the collection
      const result = await this.client.delete({
        index: this.collectionsIndexName,
        id: id,
        refresh: true, // Refresh index to make deletion immediately available
      } as any);

      return result.result === 'deleted';
    } catch (error) {
      if ((error as any)?.meta?.statusCode === 404) {
        return false; // Collection not found
      }
      throw error;
    }
  }

  async deleteCitations(itemId: string): Promise<boolean> {
    await this.checkInitialized();

    try {
      const result = await this.client.deleteByQuery({
        index: this.citationsIndexName,
        body: {
          query: {
            term: {
              itemId: itemId,
            },
          },
        },
        refresh: true, // Refresh index to make deletion immediately available
      } as any);

      return (result.deleted || 0) > 0;
    } catch (error) {
      if (
        (error as any)?.meta?.body?.error?.type === 'index_not_found_exception'
      ) {
        return false; // Index not found
      }
      throw error;
    }
  }

  

}
