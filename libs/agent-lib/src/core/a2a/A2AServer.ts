/**
 * A2A Server - Integration layer for A2A communication with AgentRuntime
 *
 * Provides A2A capabilities by integrating with AgentRuntime's topology network.
 */

import pino from 'pino';
import type { IMessageBus } from '../runtime/topology/messaging/MessageBus.js';
import type { IAgentTopologyNetwork } from '../runtime/topology/AgentTopologyNetwork.js';
import { AgentCardRegistry, getGlobalAgentRegistry } from './AgentCard.js';
import { A2AClient, createA2AClient, type IA2AClient } from './A2AClient.js';
import { A2AHandler, createA2AHandler, type IA2AHandler } from './A2AHandler.js';
import type {
  AgentCard,
  A2AMessage,
  A2ATaskHandler,
  A2AQueryHandler,
  A2AEventHandler,
  A2ACancelHandler,
  A2ATaskResult,
} from './types.js';
import { createA2AEvent } from './types.js';

export interface A2AServerConfig {
  /** This agent's instance ID */
  instanceId: string;
  /** Agent name */
  name: string;
  /** Agent description */
  description: string;
  /** Agent version */
  version?: string;
  /** Agent capabilities */
  capabilities?: string[];
  /** Agent skills */
  skills?: string[];
  /** Custom agent registry (optional) */
  registry?: AgentCardRegistry;
  /** Custom message bus (optional) */
  messageBus?: IMessageBus;
  /** Default handler timeout */
  handlerTimeout?: number;
}

export interface IA2AServer {
  /** Register this agent with its card */
  register(agentCard?: Partial<AgentCard>): void;

  /** Unregister this agent */
  unregister(): void;

  /** Get A2A Client for sending messages */
  getClient(): IA2AClient;

  /** Get A2A Handler for receiving messages */
  getHandler(): IA2AHandler;

  /** Get the agent registry */
  getRegistry(): AgentCardRegistry;

  /** Register task handler */
  onTask(handler: A2ATaskHandler): void;

  /** Register query handler */
  onQuery(handler: A2AQueryHandler): void;

  /** Register event handler */
  onEvent(handler: A2AEventHandler): void;

  /** Register cancel handler */
  onCancel(handler: A2ACancelHandler): void;

  /** Start the A2A server */
  start(): void;

  /** Stop the A2A server */
  stop(): void;

  /** Get server stats */
  getStats(): {
    instanceId: string;
    isRegistered: boolean;
    isListening: boolean;
    registryStats: ReturnType<AgentCardRegistry['getStats']>;
  };
}

/**
 * A2A Server implementation
 *
 * Integrates A2A communication with AgentRuntime by:
 * 1. Managing Agent Card registration
 * 2. Creating and managing A2A Client/Handler
 * 3. Connecting to the topology network
 */
export class A2AServer implements IA2AServer {
  private readonly logger: pino.Logger;
  private readonly instanceId: string;
  private readonly name: string;
  private readonly description: string;
  private readonly version: string;
  private readonly capabilities: string[];
  private readonly skills: string[];

  private readonly registry: AgentCardRegistry;
  private messageBus?: IMessageBus;
  private topologyNetwork?: IAgentTopologyNetwork;

  private client?: IA2AClient;
  private handler?: IA2AHandler;
  private isRegistered = false;
  private isListening = false;

  constructor(config: A2AServerConfig) {
    this.logger = pino({
      level: 'debug',
      timestamp: pino.stdTimeFunctions.isoTime,
    });
    this.instanceId = config.instanceId;
    this.name = config.name;
    this.description = config.description;
    this.version = config.version ?? '1.0.0';
    this.capabilities = config.capabilities ?? [];
    this.skills = config.skills ?? [];
    this.registry = config.registry ?? getGlobalAgentRegistry();
    this.messageBus = config.messageBus;
  }

  /**
   * Set the topology network (can be set after construction)
   */
  setTopologyNetwork(network: IAgentTopologyNetwork): void {
    this.topologyNetwork = network;
    this.messageBus = network.getMessageBus();
    this.logger.debug('Topology network set');
  }

  /**
   * Register this agent with its card
   */
  register(agentCard?: Partial<AgentCard>): void {
    const card: AgentCard = {
      instanceId: this.instanceId,
      name: agentCard?.name ?? this.name,
      description: agentCard?.description ?? this.description,
      version: agentCard?.version ?? this.version,
      capabilities: agentCard?.capabilities ?? this.capabilities,
      skills: agentCard?.skills ?? this.skills,
      endpoint: this.instanceId,
      metadata: agentCard?.metadata,
      url: agentCard?.url,
    };

    this.registry.register(card);
    this.isRegistered = true;

    this.logger.info(
      { instanceId: this.instanceId, name: card.name, capabilities: card.capabilities },
      'A2A Agent registered',
    );
  }

  /**
   * Unregister this agent
   */
  unregister(): void {
    this.registry.unregister(this.instanceId);
    this.isRegistered = false;
    this.logger.info({ instanceId: this.instanceId }, 'A2A Agent unregistered');
  }

  /**
   * Get A2A Client for sending messages
   */
  getClient(): IA2AClient {
    if (!this.client) {
      if (!this.messageBus) {
        throw new Error('MessageBus not available. Set topology network or provide messageBus.');
      }
      this.client = createA2AClient(this.messageBus, this.registry, {
        instanceId: this.instanceId,
        defaultTimeout: 60000,
      });
    }
    return this.client;
  }

  /**
   * Get A2A Handler for receiving messages
   */
  getHandler(): IA2AHandler {
    if (!this.handler) {
      if (!this.messageBus) {
        throw new Error('MessageBus not available. Set topology network or provide messageBus.');
      }
      this.handler = createA2AHandler(this.messageBus, {
        instanceId: this.instanceId,
        supportedTypes: ['task', 'query', 'event', 'cancel', 'response'],
        handlerTimeout: 60000,
      });
    }
    return this.handler;
  }

  /**
   * Get the agent registry
   */
  getRegistry(): AgentCardRegistry {
    return this.registry;
  }

  /**
   * Register task handler
   */
  onTask(handler: A2ATaskHandler): void {
    this.getHandler().onTask(handler);
  }

  /**
   * Register query handler
   */
  onQuery(handler: A2AQueryHandler): void {
    this.getHandler().onQuery(handler);
  }

  /**
   * Register event handler
   */
  onEvent(handler: A2AEventHandler): void {
    this.getHandler().onEvent(handler);
  }

  /**
   * Register cancel handler
   */
  onCancel(handler: A2ACancelHandler): void {
    this.getHandler().onCancel(handler);
  }

  /**
   * Start the A2A server
   */
  start(): void {
    if (this.isListening) {
      this.logger.warn('A2A Server already started');
      return;
    }

    // Ensure registered
    if (!this.isRegistered) {
      this.register();
    }

    // Start handler listening
    const handler = this.getHandler();
    handler.startListening();
    this.isListening = true;

    this.logger.info({ instanceId: this.instanceId }, 'A2A Server started');
  }

  /**
   * Stop the A2A server
   */
  stop(): void {
    if (!this.isListening) {
      return;
    }

    if (this.handler) {
      this.handler.stopListening();
    }

    this.isListening = false;
    this.logger.info({ instanceId: this.instanceId }, 'A2A Server stopped');
  }

  /**
   * Get server stats
   */
  getStats() {
    return {
      instanceId: this.instanceId,
      isRegistered: this.isRegistered,
      isListening: this.isListening,
      registryStats: this.registry.getStats(),
    };
  }
}

/**
 * Create an A2A Server instance
 */
export function createA2AServer(config: A2AServerConfig): A2AServer {
  return new A2AServer(config);
}

// =============================================================================
// Integration Helper - A2A Component for Agent
// =============================================================================

/**
 * A2A Component that can be added to an agent's components
 *
 * Provides A2A communication capabilities as a component.
 */
export interface A2AComponent {
  /** Get the A2A server */
  server: A2AServer;
  /** Get the A2A client */
  client: IA2AClient;
}

/**
 * Create an A2A component for an agent
 */
export function createA2AComponent(config: A2AServerConfig): A2AComponent {
  const server = createA2AServer(config);

  return {
    server,
    get client() {
      return server.getClient();
    },
  };
}
