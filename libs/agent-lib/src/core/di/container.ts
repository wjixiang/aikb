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
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
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
    public instanceId: string;
    private config: UnifiedAgentConfig;
    private agentInstance: Agent | null = null;
    private isRestoring = false;
    private initPromise: Promise<void> | null = null;

    constructor(options: AgentCreationOptions = {}, instanceId?: string) {
        this.container = new Container({
            defaultScope: 'Singleton',
        });

        if (instanceId) {
            // Restore agent: setup bindings first to get persistence service
            this.instanceId = instanceId;
            this.config = mergeWithDefaults(options); // Use provided options as base
            this.isRestoring = true;
            this.setupBindings();
            this.initPromise = this.restoreInstanceMetadata();
        } else {
            // Create new agent
            this.config = mergeWithDefaults(options);
            this.instanceId = crypto.randomUUID();
            this.setupBindings();
            this.initPromise = this.persistInstanceMetadata();
        }
    }

    private async restoreInstanceMetadata(): Promise<void> {
        // if (this.config.persistence?.enabled === false) {
        //     return;
        // }

        try {
            const persistenceService = this.container.get<IPersistenceService>(
                TYPES.IPersistenceService,
            );
            const metadata = await persistenceService.getInstanceMetadata(
                this.instanceId,
            );
            if (metadata) {
                // Restore config from stored metadata
                if (metadata.config) {
                    this.config = metadata.config as UnifiedAgentConfig;
                }
                this.logger?.info(
                    { instanceId: this.instanceId, status: metadata.status },
                    '[AgentContainer] Instance metadata restored',
                );
            } else {
                this.logger?.warn(
                    { instanceId: this.instanceId },
                    '[AgentContainer] Instance not found, will create new',
                );
                // Instance doesn't exist, persist it
                await this.persistInstanceMetadata();
            }
        } catch (error) {
            pino({ level: 'warn' }).warn(
                { error, instanceId: this.instanceId },
                '[AgentContainer] Failed to restore instance metadata',
            );
        }
    }

    private async persistInstanceMetadata(): Promise<void> {
        // if (this.config.persistence?.enabled === false) {
        //     return;
        // }

        try {
            const persistenceService = this.container.get<IPersistenceService>(
                TYPES.IPersistenceService,
            );
            await persistenceService.saveInstanceMetadata(this.instanceId, {
                status: 'idle',
                config: this.config,
                name: this.config.agent.name,
                agentType: this.config.agent.type,
            });
        } catch (error) {
            pino({ level: 'warn' }).warn(
                { error, instanceId: this.instanceId },
                '[AgentContainer] Failed to persist instance metadata',
            );
        }
    }

    private get logger(): pino.Logger | undefined {
        try {
            return this.container.get<pino.Logger>(TYPES.Logger);
        } catch {
            return undefined;
        }
    }

    private setupBindings(): void {
        this.container.bind(TYPES.AgentInstanceId).toConstantValue(this.instanceId);

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

        // Memory instance ID for persistence
        this.container
            .bind<string>(TYPES.MemoryInstanceId)
            .toConstantValue(this.instanceId);

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

        // // Persistence Service (if enabled)
        // if (this.config.persistence?.enabled !== false) {
        const databaseUrl =
            this.config.persistence?.databaseUrl || process.env['DATABASE_URL'];

        if (databaseUrl) {
            // Prisma Client
            this.container
                .bind<PrismaClient>(TYPES.PrismaClient)
                .toDynamicValue(() => {
                    const connectionString = databaseUrl || process.env['DATABASE_URL'];
                    if (!connectionString) {
                        throw new Error('Database URL not configured');
                    }
                    const pool = new pg.Pool({ connectionString });
                    const adapter = new PrismaPg(pool);
                    return new PrismaClient({ adapter });
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
        } else {
            throw new Error('binding persistenceService error: no databaseurl found')
        }
        // }

        // Container reference
        this.container
            .bind<Container>(TYPES.Container)
            .toConstantValue(this.container);
    }

    async getAgent(): Promise<Agent> {
        // Wait for initialization (AgentInstance creation) to complete
        if (this.initPromise) {
            await this.initPromise;
            this.initPromise = null;
        }

        if (!this.agentInstance) {
            this.agentInstance = this.container.get<Agent>(TYPES.Agent);

            // Register components if provided in config
            if (this.config.components && this.config.components.length > 0) {
                this.agentInstance.workspace.registerComponents(this.config.components);
            }

            // Restore component states if this is a restored instance
            if (this.isRestoring) {
                this.agentInstance.restoreComponentStates();
                this.isRestoring = false;
            }
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
