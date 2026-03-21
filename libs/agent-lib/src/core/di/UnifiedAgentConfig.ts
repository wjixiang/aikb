import type { AgentConfig, SOP } from '../agent/agent.js';
import type { VirtualWorkspaceConfig } from '../../components/core/types.js';
import type { MemoryModuleConfig } from '../memory/types.js';
import type { ProviderSettings } from '../types/provider-settings.js';
import type { PersistenceConfig } from '../persistence/types.js';
import type { ToolComponent } from '../../components/core/toolComponent.js';
import { defaultAgentConfig } from '../agent/agent.js';
import { defaultMemoryConfig } from '../memory/MemoryModule.js';

/** Component registration for DI injection */
export interface DIComponentRegistration {
  id: string;
  component: ToolComponent;
  priority?: number;
}

export interface UnifiedAgentConfig {
  agent: {
    sop: SOP;
    config: AgentConfig;
    taskId?: string;
    name?: string;       // Agent 友好名称
    type?: string;       // Agent 类型标识
    description?: string; // Agent 描述
  };
  api: ProviderSettings;
  workspace: VirtualWorkspaceConfig;
  memory: MemoryModuleConfig;
  persistence?: PersistenceConfig;

  /**
   * Components to register with the agent's workspace
   * These will be automatically registered when the agent is created
   */
  components?: DIComponentRegistration[];

  /**
   * Global components to register with the agent's workspace
   * Global components are rendered first and shared across workspace
   */
  globalComponents?: DIComponentRegistration[];
}

export interface AgentCreationOptions {
  agent?: {
    sop?: SOP;
    config?: Partial<AgentConfig>;
    taskId?: string;
    name?: string;       // Agent 友好名称
    type?: string;       // Agent 类型标识
    description?: string; // Agent 描述
  };
  api?: Partial<ProviderSettings>;
  workspace?: Partial<VirtualWorkspaceConfig>;
  memory?: Partial<MemoryModuleConfig>;
  persistence?: Partial<PersistenceConfig>;
  observers?: any;

  /**
   * Components to register with the agent's workspace
   * These will be automatically registered when the agent is created
   */
  components?: DIComponentRegistration[];

  /**
   * Global components to register with the agent's workspace
   * Global components are rendered first and shared across workspace
   */
  globalComponents?: DIComponentRegistration[];
}

export const defaultUnifiedConfig: UnifiedAgentConfig = {
  agent: {
    sop: 'Default SOP',
    config: defaultAgentConfig,
  },
  api: {
    apiProvider: 'zai',
    apiKey: process.env['GLM_API_KEY'] || '',
    apiModelId: 'glm-4.5',
    zaiApiLine: 'china_coding',
  },
  workspace: {
    id: 'default-workspace',
    name: 'Default Workspace',
    renderMode: 'tui',
    toolCallLogCount: 10,
    expertMode: false,
    alwaysRenderAllComponents: false,
  },
  memory: defaultMemoryConfig,
  persistence: {
    // enabled: true,
  },
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
    },
    api: {
      ...defaultUnifiedConfig.api,
      ...partial.api,
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
    // Pass global components from top-level options
    globalComponents: partial.globalComponents,
  };
  return result;
}
