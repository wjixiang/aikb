import { ChunkingConfig, defaultChunkingConfig } from "lib/chunking/chunkingStrategy";
import { EmbeddingConfig, defaultEmbeddingConfig } from "lib/embedding/embedding";
import { ChunkingEmbeddingGroup } from "./library";

export interface IChunkEmbedGroupStorage {
  createNewGroup: (groupInfo: ChunkingEmbeddingGroup) => Promise<boolean>;
  listGroup: () => Promise<ChunkingEmbeddingGroup[]>;
  getGroupById: (id: string) => Promise<ChunkingEmbeddingGroup>;
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