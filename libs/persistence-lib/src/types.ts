export enum AgentStatus {
  Sleeping = 'sleeping',
  Running = 'running',
  Aborted = 'aborted',
}

export interface InstanceMetadata {
  instanceId: string;
  status: AgentStatus;
  abortReason?: string;
  abortSource?: string;
  config?: unknown;
  name?: string;
  agentType?: string;
  totalTokensIn?: number;
  totalTokensOut?: number;
  totalCost?: number;
  toolUsage?: Record<string, { attempts: number; failures: number }>;
  consecutiveMistakeCount?: number;
  collectedErrors?: string[];
  exportResult?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

export interface PersistenceConfig {
  databaseUrl?: string;
  autoCommit?: boolean;
}

export interface Message {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: unknown;
}

export interface WorkspaceContextEntry {
  content: string;
  ts: number;
  iteration: number;
}

export interface IPersistenceService {
  saveInstanceMetadata(
    instanceId: string,
    data: Omit<InstanceMetadata, 'instanceId' | 'createdAt' | 'updatedAt'>,
  ): Promise<void>;

  getInstanceMetadata(instanceId: string): Promise<InstanceMetadata | null>;

  updateInstanceMetadata(
    instanceId: string,
    data: Partial<Omit<InstanceMetadata, 'instanceId' | 'createdAt' | 'updatedAt'>>,
  ): Promise<void>;

  saveMemory(
    instanceId: string,
    memory: {
      messages: Message[];
      workspaceContexts: WorkspaceContextEntry[];
      config: unknown;
    },
  ): Promise<void>;

  loadMemory(instanceId: string): Promise<{
    messages: Message[];
    workspaceContexts: WorkspaceContextEntry[];
    config: unknown;
  } | null>;

  saveComponentState(
    instanceId: string,
    componentId: string,
    stateData: unknown,
  ): Promise<void>;

  getComponentState(
    instanceId: string,
    componentId: string,
  ): Promise<unknown | null>;

  getAllComponentStates(instanceId: string): Promise<Record<string, unknown>>;

  deleteComponentState(instanceId: string, componentId: string): Promise<void>;

  saveExportResult(
    instanceId: string,
    exportResult: Record<string, unknown>,
  ): Promise<void>;

  saveToolResultBlob(
    instanceId: string,
    toolUseId: string,
    toolName: string,
    content: string,
  ): Promise<{ preview: string; originalSize: number }>;

  getToolResultBlob(
    instanceId: string,
    toolUseId: string,
  ): Promise<string | null>;

  deleteToolResultBlob(instanceId: string, toolUseId: string): Promise<void>;

  getToolResultBlobs(
    instanceId: string,
    toolUseIds: string[],
  ): Promise<Map<string, string>>;

  listAgents(filter?: {
    status?: AgentStatus;
    agentType?: string;
    take?: number;
  }): Promise<InstanceMetadata[]>;
}

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