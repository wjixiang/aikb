import { Injectable } from '@nestjs/common';
import { ElasticsearchItemVectorStorage } from 'item-vector-storage';
import { ChunkingStrategy } from '@aikb/chunking';
import { EmbeddingProvider, OpenAIModel, AlibabaModel, OnnxModel } from '@aikb/embedding';
import { libraryItemVectorProto } from 'proto-ts';

@Injectable()
export class AppService {
  private readonly itemVectorStorage: ElasticsearchItemVectorStorage;

  constructor() {
    this.itemVectorStorage = new ElasticsearchItemVectorStorage();
  }

  async createChunkEmbedGroup(request: libraryItemVectorProto.CreateChunkEmbedGroupRequest): Promise<libraryItemVectorProto.ChunkEmbedGroupMetadata> {
    // Convert protobuf types to internal types
    const chunkingConfig = {
      strategy: (request.chunkingConfig?.strategy || 'paragraph') as ChunkingStrategy,
      parameters: request.chunkingConfig?.parameters || {},
    };

    // Convert string provider to enum
    let provider: EmbeddingProvider;
    let model: OpenAIModel | AlibabaModel | OnnxModel;
    
    switch (request.embeddingConfig?.provider) {
      case 'openai':
        provider = EmbeddingProvider.OPENAI;
        model = (request.embeddingConfig?.model || 'text-embedding-ada-002') as OpenAIModel;
        break;
      case 'alibaba':
        provider = EmbeddingProvider.ALIBABA;
        model = (request.embeddingConfig?.model || 'text-embedding-v3') as AlibabaModel;
        break;
      case 'onnx':
        provider = EmbeddingProvider.ONNX;
        model = (request.embeddingConfig?.model || 'default') as unknown as OnnxModel;
        break;
      default:
        provider = EmbeddingProvider.OPENAI;
        model = OpenAIModel.TEXT_EMBEDDING_ADA_002;
    }

    const embeddingConfig = {
      provider,
      model,
      dimension: request.embeddingConfig?.dimension || 1536,
      batchSize: 20,
      maxRetries: 3,
      timeout: 20000,
    };

    // Create the chunk embedding group using the storage implementation
    const now = new Date();
    const groupConfig = {
      name: request.name,
      description: request.description,
      chunkingConfig,
      embeddingConfig,
      isDefault: request.isDefault,
      isActive: request.isActive,
      createdBy: request.createdBy,
      tags: request.tags,
      createdAt: now,
      updatedAt: now,
    };

    const createdGroup = await this.itemVectorStorage.createNewChunkEmbedGroupInfo(groupConfig);

    // Convert internal type back to protobuf type
    return {
      id: createdGroup.id,
      name: createdGroup.name,
      description: createdGroup.description || '',
      chunkingConfig: {
        strategy: createdGroup.chunkingConfig.strategy || 'paragraph',
        parameters: {},
      },
      embeddingConfig: {
        provider: createdGroup.embeddingConfig.provider,
        model: createdGroup.embeddingConfig.model as string,
        dimension: createdGroup.embeddingConfig.dimension,
        parameters: {},
      },
      isDefault: createdGroup.isDefault,
      isActive: createdGroup.isActive,
      createdAt: createdGroup.createdAt.getTime(),
      updatedAt: createdGroup.updatedAt.getTime(),
      createdBy: createdGroup.createdBy || '',
      tags: createdGroup.tags || [],
    };
  }
}