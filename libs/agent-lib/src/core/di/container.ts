import 'reflect-metadata';
import { Container } from 'inversify';
import { TYPES } from './types.js';
import { Agent } from '../agent/agent.js';
import { VirtualWorkspace } from '../statefulContext/virtualWorkspace.js';
import { MemoryModule } from '../memory/MemoryModule.js';
import { ApiClientFactory } from '../api-client/ApiClientFactory.js';
import { ToolManager } from '../tools/ToolManager.js';
import { PostgresPersistenceService } from '../persistence/PostgresPersistenceService.js';
import type { ApiClient } from '../api-client/index.js';
import type { IVirtualWorkspace } from '../../components/core/types.js';
import type { IMemoryModule } from '../memory/types.js';
import type { IToolManager } from '../tools/index.js';
import type { IPersistenceService } from '../persistence/types.js';
import { PrismaClient } from '../../generated/prisma/client.js';
import pino from 'pino';
import {
  type UnifiedAgentConfig,
  type AgentCreationOptions,
  defaultUnifiedConfig,
  mergeWithDefaults,
} from './UnifiedAgentConfig.js';
import type { TestOverrides } from './types.js';

type Logger = ReturnType<typeof pino>;

/**
 * AgentContainer - 1:1 relationship with Agent
 *
 * Each AgentContainer manages a single Agent instance and its dependencies.
 * This ensures complete isolation between agents.
 *
 * @example
 * ```typescript
 * const container = new AgentContainer({
 *   agent: { sop: 'My SOP' },
 *   api: { apiKey: '...' }
 * });
 * const agent = container.getAgent();
 * ```
 */
export class AgentContainer {
  private container: Container;
  private config: UnifiedAgentConfig;
  private agentInstance: Agent | null = null;

  constructor(options: AgentCreationOptions = {}) {
    this.config = mergeWithDefaults(options);
    this.container = new Container({
      defaultScope: 'Singleton',
    });
    this.setupBindings();
  }

  private setupBindings(): void {
    // Logger
    this.container.bind<Logger>(TYPES.Logger).toDynamicValue(() =>
      pino({
        level: process.env['LOG_LEVEL'] || 'debug',
        formatters: {
          level: (label) => ({ level: label }),
        },
        timestamp: pino.stdTimeFunctions.isoTime,
      }),
    );

    // Agent configuration
    this.container
      .bind(TYPES.AgentConfig)
      .toConstantValue(this.config.agent.config);
    this.container
      .bind(TYPES.ProviderSettings)
      .toConstantValue(this.config.api);
    this.container
      .bind(TYPES.AgentPrompt)
      .toConstantValue(this.config.agent.sop);
    this.container
      .bind(TYPES.VirtualWorkspaceConfig)
      .toConstantValue(this.config.workspace);
    this.container
      .bind(TYPES.MemoryModuleConfig)
      .toConstantValue(this.config.memory);

    if (this.config.agent.taskId) {
      this.container
        .bind<string>(TYPES.TaskId)
        .toConstantValue(this.config.agent.taskId);
    }

    // Services (all singleton within this container)
    this.container.bind(TYPES.Agent).to(Agent).inSingletonScope();
    this.container
      .bind(TYPES.IVirtualWorkspace)
      .to(VirtualWorkspace)
      .inSingletonScope();
    this.container
      .bind(TYPES.IMemoryModule)
      .to(MemoryModule)
      .inSingletonScope();
    this.container.bind(TYPES.IToolManager).to(ToolManager).inSingletonScope();

    // API Client
    this.container
      .bind<ApiClient>(TYPES.ApiClient)
      .toDynamicValue(() => {
        return ApiClientFactory.create(this.config.api);
      })
      .inSingletonScope();

    // Persistence Service (if enabled)
    if (this.config.persistence?.enabled !== false) {
      const databaseUrl =
        this.config.persistence?.databaseUrl || process.env['DATABASE_URL'];

      if (databaseUrl) {
        // Prisma Client
        this.container
          .bind<PrismaClient>('PrismaClient')
          .toDynamicValue(() => {
            return new PrismaClient({
              datasources: { db: { url: databaseUrl } },
            });
          })
          .inSingletonScope();

        // Persistence Config
        this.container.bind(TYPES.PersistenceConfig).toConstantValue({
          enabled: true,
          databaseUrl,
          autoCommit: this.config.persistence?.autoCommit ?? true,
        });

        // Persistence Service
        this.container
          .bind<IPersistenceService>(TYPES.IPersistenceService)
          .to(PostgresPersistenceService)
          .inSingletonScope();
      }
    }

    // Container reference
    this.container
      .bind<Container>(TYPES.Container)
      .toConstantValue(this.container);
  }

  getAgent(): Agent {
    if (!this.agentInstance) {
      this.agentInstance = this.container.get<Agent>(TYPES.Agent);
    }
    return this.agentInstance;
  }

  getConfig(): UnifiedAgentConfig {
    return this.config;
  }

  getContainer(): Container {
    return this.container;
  }
}

// Re-export types from UnifiedAgentConfig
export type {
  AgentCreationOptions,
  UnifiedAgentConfig,
} from './UnifiedAgentConfig.js';
export {
  defaultUnifiedConfig,
  mergeWithDefaults,
} from './UnifiedAgentConfig.js';
