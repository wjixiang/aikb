import type { AgentConfig, SOP } from '../agent/agent.js';
import type { VirtualWorkspaceConfig } from '../../components/core/types.js';
import type { MemoryModuleConfig } from '../memory/types.js';
import type { PersistenceConfig, IPersistenceService } from '../persistence/types.js';
import type { ToolComponent } from '../../components/core/toolComponent.js';
import type { ApiClient } from 'llm-api-client';
import type { HookConfig } from '../hooks/types.js';

import { defaultAgentConfig } from '../agent/agent.js';
import { defaultMemoryConfig } from '../memory/MemoryModule.js';

/** Component registration for DI injection */
export interface DIComponentRegistration {
  /** Component class (will be instantiated by factory with DI) */
  componentClass?: new (...args: any[]) => ToolComponent;
  /** Pre-instantiated component (bypasses DI resolution) */
  componentInstance?: ToolComponent;
}

export interface UnifiedAgentConfig {
  agent: {
    sop: SOP;
    config: AgentConfig;
    taskId?: string;
    name?: string; // Agent 友好名称
    type?: string; // Agent 类型标识
    description?: string; // Agent 描述
    // A2A service discovery fields
    version?: string;
    capabilities?: string[];
    skills?: string[];
    endpoint?: string;
    metadata?: Record<string, unknown>;
  };
  workspace: VirtualWorkspaceConfig;
  memory: MemoryModuleConfig;
  persistence?: PersistenceConfig;

  /**
   * Components to register with the agent's workspace
   * These will be automatically registered when the agent is created.
   */
  components?: DIComponentRegistration[];

  /**
   * Hook configuration for lifecycle events
   */
  hooks?: HookConfig;

  /**
   * ApiClient instance for LLM API calls.
   * This replaces the previous clientPool pattern.
   */
  apiClient?: ApiClient;

  /**
   * External persistence service instance.
   * Required for agent container to function.
   */
  persistenceService: IPersistenceService;
}

export interface AgentCreationOptions {
  agent?: {
    sop?: SOP;
    config?: Partial<AgentConfig>;
    taskId?: string;
    name?: string; // Agent 友好名称
    type?: string; // Agent 类型标识
    description?: string; // Agent 描述
    // A2A service discovery fields
    version?: string;
    capabilities?: string[];
    skills?: string[];
    endpoint?: string;
    metadata?: Record<string, unknown>;
  };
  workspace?: Partial<VirtualWorkspaceConfig>;
  memory?: Partial<MemoryModuleConfig>;
  persistence?: Partial<PersistenceConfig>;
  observers?: any;

  /**
   * Components to register with the agent's workspace
   * These will be automatically registered when the agent is created.
   */
  components?: DIComponentRegistration[];

  /**
   * Hook configuration for lifecycle events
   */
  hooks?: HookConfig;

  /**
   * ApiClient instance for LLM API calls.
   */
  apiClient?: ApiClient;

  /**
   * External persistence service instance.
   * Required for agent container to function.
   */
  persistenceService: IPersistenceService;
}

export const defaultUnifiedConfig: UnifiedAgentConfig = {
  agent: {
    sop: 'Default SOP',
    config: defaultAgentConfig,
  },
  workspace: {
    id: 'default-workspace',
    name: 'Default Workspace',
    renderMode: 'tui',
    expertMode: false,
    alwaysRenderAllComponents: false,
  },
  memory: defaultMemoryConfig,
  persistence: {
    // enabled: true,
  },
  // persistenceService must be provided at runtime - this default allows type checking only
  persistenceService: undefined as unknown as IPersistenceService,
};

export function mergeWithDefaults(
  partial: AgentCreationOptions,
): UnifiedAgentConfig {
  const result: UnifiedAgentConfig = {
    agent: {
      sop: partial.agent?.sop ?? defaultUnifiedConfig.agent.sop,
      config: {
        ...defaultUnifiedConfig.agent.config,
        ...partial.agent?.config,
      },
      taskId: partial.agent?.taskId ?? defaultUnifiedConfig.agent.taskId,
      name: partial.agent?.name,
      type: partial.agent?.type,
      description: partial.agent?.description,
      // A2A service discovery fields
      version: partial.agent?.version,
      capabilities: partial.agent?.capabilities,
      skills: partial.agent?.skills,
      endpoint: partial.agent?.endpoint,
      metadata: partial.agent?.metadata,
    },
    workspace: {
      ...defaultUnifiedConfig.workspace,
      ...partial.workspace,
    },
    memory: {
      ...defaultUnifiedConfig.memory,
      ...partial.memory,
    },
    persistence:
      partial.persistence !== undefined
        ? { ...partial.persistence }
        : defaultUnifiedConfig.persistence,
    // Pass components from top-level options
    components: partial.components,
    // Pass hooks from top-level options
    hooks: partial.hooks,
    // Pass ApiClient for LLM API calls
    apiClient: partial.apiClient,
    // Pass external persistence service (not merged with defaults, passed as-is)
    persistenceService: partial.persistenceService,
  };
  return result;
}
