import { ChunkingConfig } from "chunking";
import { EmbeddingConfig } from "embedding";

export interface CreateChunkEmbedGroupRequest {
    itemId: string;
  name: string|undefined;
  description: string | undefined;
  chunkingConfig: ChunkingConfig | undefined;
  embeddingConfig: EmbeddingConfig | undefined;
  isDefault: boolean | undefined;
  isActive: boolean | undefined;
  createdBy: string | undefined;
}
