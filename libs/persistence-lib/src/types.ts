export interface PersistedToolResult {
  id: string;
  instanceId: string;
  toolUseId: string;
  toolName: string;
  content: string;
  size: number;
  createdAt: Date;
}

export interface PersistResult {
  persistedId: string;
  preview: string;
  originalSize: number;
  hasMore: boolean;
}

export interface IToolResultPersister {
  persist(
    instanceId: string,
    toolUseId: string,
    toolName: string,
    content: string,
  ): Promise<PersistResult>;

  retrieve(id: string): Promise<string | null>;
  retrieveByToolUseId(toolUseId: string): Promise<PersistedToolResult | null>;
  delete(id: string): Promise<void>;
  deleteByInstanceId(instanceId: string): Promise<void>;
  deleteByToolUseId(toolUseId: string): Promise<void>;
}

export const DEFAULT_MAX_RESULT_SIZE_CHARS = 50_000;
export const PREVIEW_SIZE_BYTES = 2_000;
