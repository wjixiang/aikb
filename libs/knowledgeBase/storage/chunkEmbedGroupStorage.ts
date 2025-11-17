import { ChunkingConfig, defaultChunkingConfig } from '@aikb/chunking';
import { EmbeddingConfig, defaultEmbeddingConfig } from 'embedding';
import { ChunkingEmbeddingGroup } from 'knowledgeBase/knowledgeImport/library';
import { Client } from '@elastic/elasticsearch';

export interface IChunkEmbedGroupStorage {
  createNewGroup: (groupInfo: ChunkingEmbeddingGroup) => Promise<boolean>;
  listGroup: () => Promise<ChunkingEmbeddingGroup[]>;
  getGroupById: (id: string) => Promise<ChunkingEmbeddingGroup>;
}

export class elasticsearchChunkEmbedGroupStorage
  implements IChunkEmbedGroupStorage
{
  private client: Client;
  private indexName = 'chunk_embed_groups';
  private isInitialized = false;

  constructor(
    elasticsearchUrl: string = process.env.ELASTICSEARCH_URL ??
      'http://elasticsearch:9200',
  ) {
    this.client = new Client({
      node: elasticsearchUrl,
      auth: {
        apiKey: process.env.ELASTICSEARCH_API_KEY || '',
      },
    });
  }

  /**
   * Initialize the storage by ensuring the index exists
   */
  private async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Check if index exists
      const indexExists = await this.client.indices.exists({
        index: this.indexName,
      });

      if (!indexExists) {
        await this.client.indices.create({
          index: this.indexName,
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
              chunkingConfig: { type: 'object' },
              embeddingConfig: { type: 'object' },
              isDefault: { type: 'boolean' },
              isActive: { type: 'boolean' },
              createdAt: { type: 'date' },
              updatedAt: { type: 'date' },
              createdBy: { type: 'keyword' },
              tags: {
                type: 'text',
                fields: {
                  keyword: { type: 'keyword' },
                },
              },
            },
          },
        });
      }

      this.isInitialized = true;
    } catch (error) {
      throw new Error(
        `Failed to initialize elasticsearchChunkEmbedGroupStorage: ${error}`,
      );
    }
  }

  /**
   * Create a new chunk embedding group
   */
  async createNewGroup(groupInfo: ChunkingEmbeddingGroup): Promise<boolean> {
    try {
      await this.initialize();

      // Ensure the group has an ID
      if (!groupInfo.id) {
        throw new Error('Group ID is required');
      }

      // Check if group with the same ID already exists
      try {
        const existingGroup = await this.getGroupById(groupInfo.id);
        if (existingGroup) {
          throw new Error(`Group with ID ${groupInfo.id} already exists`);
        }
      } catch (error) {
        // If group doesn't exist, that's expected - continue with creation
        if (error instanceof Error && error.message.includes('not found')) {
          // Group doesn't exist, proceed with creation
        } else {
          // Re-throw other errors
          throw error;
        }
      }

      // Set timestamps if not provided
      const groupToCreate = {
        ...groupInfo,
        createdAt: groupInfo.createdAt || new Date(),
        updatedAt: groupInfo.updatedAt || new Date(),
      };

      await this.client.index({
        index: this.indexName,
        id: groupToCreate.id,
        document: groupToCreate,
        refresh: true,
      });

      return true;
    } catch (error) {
      throw new Error(`Failed to create new group: ${error}`);
    }
  }

  /**
   * List all chunk embedding groups
   */
  async listGroup(): Promise<ChunkingEmbeddingGroup[]> {
    try {
      await this.initialize();

      const response = await this.client.search({
        index: this.indexName,
        query: {
          match_all: {},
        },
        size: 10000, // Adjust based on expected number of groups
        sort: [{ createdAt: { order: 'desc' } }],
      });

      const hits = response.hits.hits as any[];
      return hits.map((hit) => hit._source as ChunkingEmbeddingGroup);
    } catch (error) {
      // If index doesn't exist, return empty array
      if (
        error?.meta?.statusCode === 404 ||
        error?.meta?.body?.error?.type === 'index_not_found_exception'
      ) {
        return [];
      }
      throw new Error(`Failed to list groups: ${error}`);
    }
  }

  /**
   * Get a chunk embedding group by ID
   */
  async getGroupById(id: string): Promise<ChunkingEmbeddingGroup> {
    try {
      await this.initialize();

      const response = await this.client.get({
        index: this.indexName,
        id: id,
      });

      if (response.found) {
        return response._source as ChunkingEmbeddingGroup;
      }

      throw new Error(`Group with ID ${id} not found`);
    } catch (error) {
      if (error?.meta?.statusCode === 404) {
        throw new Error(`Group with ID ${id} not found`);
      }
      throw new Error(`Failed to get group by ID: ${error}`);
    }
  }
}

export async function createItemChunkEmbedGroup(
  itemId: string,
  storage: IChunkEmbedGroupStorage,
  groupName?: string,
  chunkingConfig?: ChunkingConfig,
  embeddingConfig?: EmbeddingConfig,
) {
  const groupId = `${itemId}-${groupName}-${Date.now()}`;
  const groupInfo: ChunkingEmbeddingGroup = {
    id: groupId,
    name: groupName ?? `unamedGroup-${Date.now()}`,
    chunkingConfig: chunkingConfig ?? defaultChunkingConfig,
    embeddingConfig: embeddingConfig ?? defaultEmbeddingConfig,
    isDefault: false,
    isActive: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  return await storage.createNewGroup(groupInfo);
}
