import { Controller } from '@nestjs/common';
import { Implement, implement, ORPCError } from '@orpc/nest';
import { CreateEntityContract } from './orpc.contract';
import { KnowledgeManagementService } from 'knowledgeBase-lib';

@Controller('orpc')
export class KnowledgeBaseOrpcController {
  constructor(
    private readonly knowledgeManagementService: KnowledgeManagementService,
  ) {}

  @Implement(CreateEntityContract)
  create() {
    return implement(CreateEntityContract).handler(async ({ input }) => {
      console.log('[KnowledgeBaseOrpcController] Received input:', input);

      // Convert input to entity data format
      const entityData = {
        nomenclature: input.nomenclature.map((n) => ({
          name: n.name,
          acronym: n.acronym || null,
          language: n.language,
        })),
        abstract: {
          description: input.abstract.description,
          // Embedding will be generated server-side in the service layer
        },
      };

      console.log(
        '[KnowledgeBaseOrpcController] Processed entityData:',
        entityData,
      );
      const result =
        await this.knowledgeManagementService.createEntity(entityData);

      // Transform the result to match the contract output schema
      // Convert EmbeddingModel enum to string for the response
      const transformedResult = {
        ...result,
        abstract: {
          ...result.abstract,
          embedding: result.abstract.embedding
            ? {
                config: {
                  model: String(result.abstract.embedding.config.model),
                  dimension: result.abstract.embedding.config.dimension,
                  batchSize: result.abstract.embedding.config.batchSize,
                  maxRetries: result.abstract.embedding.config.maxRetries,
                  timeout: result.abstract.embedding.config.timeout,
                  provider: result.abstract.embedding.config.provider,
                },
                vector: result.abstract.embedding.vector,
              }
            : undefined,
        },
      };

      return transformedResult;
    });
  }
}
