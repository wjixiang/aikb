/**
 * LLM Pool - Fastify Server
 *
 * Main server with routes for OpenAI and Anthropic compatible APIs
 */

import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import pino from 'pino';
import * as YAML from 'yaml';
import { readFileSync } from 'fs';
import { join } from 'path';

import { Config, ConfigSchema, VirtualModelConfig, BackendConfig } from './config.js';
import { LoadBalancer } from './loadbalancer.js';
import { BackendClientFactory } from './backend-client.js';
import {
  ChatRequest,
  OpenAIChatCompletionRequest,
  AnthropicMessageCreateRequest,
  ApiMode,
} from './types.js';

export class LLMPoolServer {
  private app: FastifyInstance;
  private config: Config;
  private loadBalancer: LoadBalancer;
  private backendClients: Map<string, ReturnType<typeof BackendClientFactory.create>> = new Map();
  private virtualModels: Map<string, VirtualModelConfig> = new Map();
  private logger: pino.Logger;

  constructor(config: Config) {
    this.config = config;

    // Setup logger
    this.logger = pino({
      level: config.server.logLevel,
    });

    // Initialize Fastify
    this.app = Fastify({
      logger: {
        level: this.config.server.logLevel,
      },
    });

    // Initialize load balancer
    this.loadBalancer = new LoadBalancer('weighted', this.logger);
  }

  /**
   * Initialize the server (must be called before start)
   */
  async initialize(): Promise<void> {
    await this.setup();
  }

  private async setup(): Promise<void> {
    // Setup CORS
    if (this.config.server.cors.enabled) {
      // @ts-ignore - Fastify CORS types are incompatible between versions
      await this.app.register(cors, {
        origin: this.config.server.cors.origins,
        credentials: true,
      });
    }

    // Register backends
    for (const backend of this.config.backends) {
      this.registerBackend(backend);
    }

    // Register virtual models
    for (const vm of this.config.virtualModels) {
      this.virtualModels.set(vm.name, vm);
    }

    // Setup routes
    this.setupRoutes();

    // Health check
    this.app.get('/health', async () => {
      return {
        status: 'ok',
        backends: this.loadBalancer.getBackendStatuses(),
        virtualModels: Array.from(this.virtualModels.keys()),
      };
    });

    // Metrics endpoint
    this.app.get('/metrics', async () => {
      return {
        backends: this.loadBalancer.getBackendStatuses(),
        virtualModels: Array.from(this.virtualModels.entries()).map(([name, vm]) => ({
          name,
          strategy: vm.strategy,
          backendCount: vm.backends.length,
        })),
      };
    });

    // Virtual models list
    this.app.get('/v1/models', async () => {
      return {
        object: 'list',
        data: Array.from(this.virtualModels.entries()).map(([name, vm]) => ({
          id: name,
          object: 'model',
          created: Date.now(),
          owned_by: 'llm-pool',
          strategy: vm.strategy,
          backends: vm.backends,
        })),
      };
    });

    // Model info
    this.app.get('/v1/models/:model', async (request: FastifyRequest<{ Params: { model: string } }>, reply: FastifyReply) => {
      const modelName = request.params.model;
      const vm = this.virtualModels.get(modelName);

      if (!vm) {
        return reply.code(404).send({
          error: {
            message: `Model '${modelName}' not found`,
            type: 'invalid_request_error',
            code: 'model_not_found',
          },
        });
      }

      return {
        id: modelName,
        object: 'model',
        created: Date.now(),
        owned_by: 'llm-pool',
        strategy: vm.strategy,
        backends: vm.backends,
      };
    });
  }

  private registerBackend(config: BackendConfig): void {
    this.loadBalancer.registerBackend(config);
    const client = BackendClientFactory.create(config, this.logger);
    this.backendClients.set(config.id, client);
  }

  private setupRoutes(): void {
    // OpenAI Compatible - Chat Completions
    this.app.post(
      '/v1/chat/completions',
      {
        schema: {
          body: {
            type: 'object',
            required: ['model', 'messages'],
            properties: {
              model: { type: 'string' },
              messages: { type: 'array' },
              temperature: { type: 'number' },
              max_tokens: { type: 'number' },
              stream: { type: 'boolean' },
              tools: { type: 'array' },
              stop: { oneOf: [{ type: 'string' }, { type: 'array' }] },
            },
          },
        },
      },
      async (request: FastifyRequest<{ Body: OpenAIChatCompletionRequest }>, reply: FastifyReply) => {
        const body = request.body;
        const modelName = body.model;

        return this.handleChatRequest(modelName, body, 'openai', reply);
      }
    );

    // Anthropic Compatible - Messages
    this.app.post(
      '/v1/messages',
      {
        schema: {
          body: {
            type: 'object',
            required: ['model', 'messages'],
            properties: {
              model: { type: 'string' },
              messages: { type: 'array' },
              system: { type: 'string' },
              temperature: { type: 'number' },
              max_tokens: { type: 'number' },
              stream: { type: 'boolean' },
              tools: { type: 'array' },
            },
          },
        },
      },
      async (request: FastifyRequest<{ Body: AnthropicMessageCreateRequest }>, reply: FastifyReply) => {
        const body = request.body;
        const modelName = body.model;

        return this.handleChatRequest(modelName, body, 'anthropic', reply);
      }
    );

    // Legacy routes for compatibility
    this.app.post('/chat/completions', async (request: FastifyRequest<{ Body: OpenAIChatCompletionRequest }>, reply: FastifyReply) => {
      const body = request.body;
      const modelName = body.model;
      return this.handleChatRequest(modelName, body, 'openai', reply);
    });

    this.app.post('/messages', async (request: FastifyRequest<{ Body: AnthropicMessageCreateRequest }>, reply: FastifyReply) => {
      const body = request.body;
      const modelName = body.model;
      return this.handleChatRequest(modelName, body, 'anthropic', reply);
    });
  }

  private async handleChatRequest(
    modelName: string,
    request: OpenAIChatCompletionRequest | AnthropicMessageCreateRequest,
    mode: ApiMode,
    reply: FastifyReply
  ): Promise<any> {
    // Get headers from raw request
    const headers = reply.request.headers as Record<string, string | string[] | undefined>;
    // Find virtual model
    const vm = this.virtualModels.get(modelName);
    if (!vm) {
      return reply.code(404).send({
        error: {
          message: `Model '${modelName}' not found`,
          type: 'invalid_request_error',
          code: 'model_not_found',
        },
      });
    }

    // Check authentication
    if (this.config.server.auth.enabled) {
      const authHeader = Array.isArray(headers.authorization) ? headers.authorization[0] : headers.authorization;
      const apiKey = authHeader?.replace('Bearer ', '') ||
                     (Array.isArray(headers['x-api-key']) ? headers['x-api-key'][0] : headers['x-api-key']);
      if (!apiKey || !this.config.server.auth.apiKeys.includes(apiKey)) {
        return reply.code(401).send({
          error: {
            message: 'Invalid or missing API key',
            type: 'authentication_error',
            code: 'invalid_api_key',
          },
        });
      }
    }

    // Convert request to unified format
    const chatRequest = this.convertRequest(request, mode);

    // Select backend
    let backend = this.loadBalancer.selectBackend(vm.backends);
    if (!backend) {
      return reply.code(503).send({
        error: {
          message: 'No available backends',
          type: 'service_unavailable',
          code: 'no_backends',
        },
      });
    }

    // Handle streaming
    if (chatRequest.stream) {
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });

      try {
        const client = this.backendClients.get(backend.config.id);
        if (!client) {
          throw new Error(`No client for backend ${backend.config.id}`);
        }

        this.loadBalancer.startRequest(backend.config.id);

        await client.streamChat(chatRequest, (chunk) => {
          reply.raw.write(chunk);
        });

        this.loadBalancer.completeRequest(backend.config.id, 0);
      } catch (error: any) {
        this.loadBalancer.failRequest(backend.config.id, error.message);
        this.logger.error({ error, backendId: backend?.config.id }, 'Streaming request failed');
      } finally {
        reply.raw.end();
      }

      return reply;
    }

    // Non-streaming request with retry logic
    const maxRetries = vm.backends.length;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      if (!backend) {
        break;
      }

      try {
        const client = this.backendClients.get(backend.config.id);
        if (!client) {
          throw new Error(`No client for backend ${backend.config.id}`);
        }

        this.loadBalancer.startRequest(backend.config.id);
        const startTime = Date.now();

        const response = await client.chat(chatRequest);

        const latency = Date.now() - startTime;
        this.loadBalancer.completeRequest(backend.config.id, latency);

        // Convert response based on mode
        return this.convertResponse(response, mode);
      } catch (error: any) {
        lastError = error;
        this.loadBalancer.failRequest(backend.config.id, error.message);
        this.logger.error({ error, backendId: backend.config.id, attempt: attempt + 1 }, 'Request failed, trying next backend');

        // Try next backend if configured
        if (vm.fallback === 'next-backend') {
          backend = this.loadBalancer.selectBackend(vm.backends);
        } else if (vm.fallback === 'error') {
          break;
        }
      }
    }

    // All backends failed
    return reply.code(503).send({
      error: {
        message: lastError?.message || 'All backends failed',
        type: 'service_unavailable',
        code: 'backend_error',
      },
    });
  }

  private convertRequest(
    request: OpenAIChatCompletionRequest | AnthropicMessageCreateRequest,
    mode: ApiMode
  ): ChatRequest {
    if (mode === 'openai') {
      const req = request as OpenAIChatCompletionRequest;
      return {
        model: req.model,
        messages: req.messages as any,
        tools: req.tools,
        temperature: req.temperature,
        max_tokens: req.max_tokens,
        stream: req.stream,
        stop: req.stop,
      };
    } else {
      const req = request as AnthropicMessageCreateRequest;
      // Convert Anthropic tools format to OpenAI format for unified handling
      const tools = req.tools?.map((t) => ({
        type: 'function' as const,
        function: {
          name: t.name,
          description: t.description,
          parameters: t.input_schema,
        },
      }));
      return {
        model: req.model,
        messages: req.messages as any,
        system: req.system,
        tools,
        temperature: req.temperature,
        max_tokens: req.max_tokens,
        stream: req.stream,
      };
    }
  }

  private convertResponse(response: any, mode: ApiMode): any {
    if (mode === 'anthropic') {
      // Convert OpenAI format to Anthropic format
      const choice = response.choices[0];
      const content = choice.message.content || '';
      const toolUses = choice.message.tool_calls || [];

      const contentBlocks: Array<{ type: 'text'; text: string } | { type: 'tool_use'; id: string; name: string; input: any }> = [];

      if (content) {
        contentBlocks.push({ type: 'text', text: content });
      }

      for (const tc of toolUses) {
        contentBlocks.push({
          type: 'tool_use',
          id: tc.id,
          name: tc.function.name,
          input: JSON.parse(tc.function.arguments),
        });
      }

      return {
        id: response.id,
        type: 'message',
        role: 'assistant',
        content: contentBlocks,
        model: response.model,
        stop_reason: choice.finish_reason === 'stop' ? 'end_turn' : choice.finish_reason === 'length' ? 'max_tokens' : null,
        stop_sequence: null,
        usage: {
          input_tokens: response.usage.prompt_tokens,
          output_tokens: response.usage.completion_tokens,
        },
      };
    }

    return response;
  }

  /**
   * Start the server
   */
  async start(): Promise<void> {
    try {
      await this.app.listen({
        host: this.config.server.host,
        port: this.config.server.port,
      });
      this.logger.info(`LLM Pool server listening on ${this.config.server.host}:${this.config.server.port}`);
    } catch (err) {
      this.logger.error(err, 'Failed to start server');
      throw err;
    }
  }

  /**
   * Stop the server
   */
  async stop(): Promise<void> {
    await this.app.close();

    // Close all backend clients
    for (const [id, client] of this.backendClients) {
      await client.close();
    }
    this.backendClients.clear();

    this.logger.info('LLM Pool server stopped');
  }
}

/**
 * Substitute environment variables in a string
 * Supports ${VAR_NAME} and ${VAR_NAME:-default} syntax
 */
function substituteEnvVars(str: string): string {
  return str.replace(/\$\{([^}]+)\}/g, (match, expr) => {
    const [varName, defaultValue] = expr.split(':-');
    return process.env[varName] ?? defaultValue ?? '';
  });
}

/**
 * Recursively substitute environment variables in an object
 */
function substituteEnvVarsInObject(obj: any): any {
  if (typeof obj === 'string') {
    return substituteEnvVars(obj);
  }
  if (Array.isArray(obj)) {
    return obj.map(substituteEnvVarsInObject);
  }
  if (obj && typeof obj === 'object') {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = substituteEnvVarsInObject(value);
    }
    return result;
  }
  return obj;
}

/**
 * Load configuration from file or use default
 */
export function loadConfig(configPath?: string): Config {
  if (configPath) {
    try {
      const content = readFileSync(configPath, 'utf-8');
      let config = configPath.endsWith('.yaml') || configPath.endsWith('.yml')
        ? YAML.parse(content)
        : JSON.parse(content);

      // Substitute environment variables
      config = substituteEnvVarsInObject(config);

      return ConfigSchema.parse(config);
    } catch (error) {
      console.error(`Failed to load config from ${configPath}:`, error);
    }
  }

  // Use environment variables or default
  const config: Config = {
    server: {
      host: process.env.LLM_POOL_HOST || '0.0.0.0',
      port: parseInt(process.env.LLM_POOL_PORT || '3000', 10),
      cors: {
        enabled: true,
        origins: ['*'],
      },
      logLevel: (process.env.LLM_POOL_LOG_LEVEL as any) || 'info',
      auth: {
        enabled: !!process.env.LLM_POOL_API_KEYS,
        apiKeys: process.env.LLM_POOL_API_KEYS?.split(',') || [],
      },
    },
    backends: [],
    virtualModels: [],
  };

  // Load backends from environment
  const backendsJson = process.env.LLM_POOL_BACKENDS;
  if (backendsJson) {
    try {
      const backends = JSON.parse(backendsJson);
      config.backends = backends;
    } catch (e) {
      console.error('Failed to parse LLM_POOL_BACKENDS:', e);
    }
  }

  // Load virtual models from environment
  const modelsJson = process.env.LLM_POOL_MODELS;
  if (modelsJson) {
    try {
      const models = JSON.parse(modelsJson);
      config.virtualModels = models;
    } catch (e) {
      console.error('Failed to parse LLM_POOL_MODELS:', e);
    }
  }

  return ConfigSchema.parse(config);
}
