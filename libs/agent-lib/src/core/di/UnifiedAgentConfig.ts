import type { AgentConfig, SOP } from '../agent/agent.js';
import type { VirtualWorkspaceConfig } from '../../components/core/types.js';
import type { MemoryModuleConfig } from '../memory/types.js';
import type { PersistenceConfig, IPersistenceService } from '../persistence/types.js';
import type { ToolComponent } from '../../components/core/toolComponent.js';
import type { ApiClient } from 'llm-api-client';
import type { HookConfig } from '../hooks/types.js';

import { defaultAgentConfig } from '../agent/agent.js';
import { defaultMemoryConfig } from '../memory/MemoryModule.js';

export interface DIComponentRegistration {
  componentClass?: new (...args: any[]) => ToolComponent;
  componentInstance?: ToolComponent;
}

// ==================== Agent Identity ====================

export interface AgentIdentity {
  name?: string;
  type?: string;
  description?: string;
  version?: string;
  capabilities?: string[];
  skills?: string[];
  endpoint?: string;
  metadata?: Record<string, unknown>;
}

export type PartialAgentIdentity = Partial<AgentIdentity>;

// ==================== AgentConfigBundle (serializable) ====================

export interface AgentConfigBundle {
  agent: {
    sop: SOP;
    config: AgentConfig;
    taskId?: string;
  } & AgentIdentity;
  workspace: VirtualWorkspaceConfig;
  memory: MemoryModuleConfig;
  persistence?: PersistenceConfig;
}

export interface PartialAgentConfigBundle {
  agent?: {
    sop?: SOP;
    config?: Partial<AgentConfig>;
    taskId?: string;
  } & PartialAgentIdentity;
  workspace?: Partial<VirtualWorkspaceConfig>;
  memory?: Partial<MemoryModuleConfig>;
  persistence?: Partial<PersistenceConfig>;
}

// ==================== AgentDependencies (runtime instances) ====================

export interface AgentDependencies {
  apiClient: ApiClient;
  persistenceService: IPersistenceService;
  components?: DIComponentRegistration[];
  hooks?: HookConfig;
}

export type PartialAgentDependencies = {
  apiClient?: ApiClient;
  persistenceService?: IPersistenceService;
  components?: DIComponentRegistration[];
  hooks?: HookConfig;
};

// ==================== UnifiedAgentConfig ====================

export interface UnifiedAgentConfig extends AgentConfigBundle, AgentDependencies {}

export interface AgentCreationOptions
  extends PartialAgentConfigBundle,
    PartialAgentDependencies {
  observers?: any;
}

// ==================== Defaults ====================

const defaultConfigBundle: AgentConfigBundle = {
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
  persistence: {},
};

export const defaultUnifiedConfig: UnifiedAgentConfig = {
  ...defaultConfigBundle,
  apiClient: undefined as unknown as ApiClient,
  persistenceService: undefined as unknown as IPersistenceService,
};

// ==================== Merge helpers ====================

function mergeAgentIdentity(
  base: AgentIdentity,
  override?: PartialAgentIdentity,
): AgentIdentity {
  if (!override) return base;
  return {
    name: override.name ?? base.name,
    type: override.type ?? base.type,
    description: override.description ?? base.description,
    version: override.version ?? base.version,
    capabilities: override.capabilities ?? base.capabilities,
    skills: override.skills ?? base.skills,
    endpoint: override.endpoint ?? base.endpoint,
    metadata: override.metadata ?? base.metadata,
  };
}

export function mergeConfigBundle(
  partial?: PartialAgentConfigBundle,
): AgentConfigBundle {
  return {
    agent: {
      sop: partial?.agent?.sop ?? defaultConfigBundle.agent.sop,
      config: {
        ...defaultConfigBundle.agent.config,
        ...partial?.agent?.config,
      },
      taskId: partial?.agent?.taskId ?? defaultConfigBundle.agent.taskId,
      ...mergeAgentIdentity(defaultConfigBundle.agent, partial?.agent),
    },
    workspace: {
      ...defaultConfigBundle.workspace,
      ...partial?.workspace,
    },
    memory: {
      ...defaultConfigBundle.memory,
      ...partial?.memory,
    },
    persistence:
      partial?.persistence !== undefined
        ? { ...partial.persistence }
        : defaultConfigBundle.persistence,
  };
}

export function mergeWithDefaults(
  partial: AgentCreationOptions,
): UnifiedAgentConfig {
  const { observers: _observers, ...configAndDeps } = partial;
  return {
    ...mergeConfigBundle(configAndDeps),
    apiClient: partial.apiClient!,
    persistenceService: partial.persistenceService!,
    components: partial.components,
    hooks: partial.hooks,
  };
}
