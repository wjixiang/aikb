import pino from 'pino';
import {
  ApiClient,
  ApiResponse,
  ApiTimeoutConfig,
  ChatCompletionTool,
} from '../types/api-client.js';
import {
  ApiClientError,
  ConfigurationError,
  RateLimitError,
  TimeoutError,
  UnknownApiError,
  ValidationError,
} from '../errors/errors.js';
import { createLogger } from './logger.js';

export interface BaseClientConfig {
  apiKey: string;
  model: string;
  baseURL?: string;
  temperature?: number;
  maxTokens?: number;
  maxRetries?: number;
  retryDelay?: number;
  enableLogging?: boolean;
  logger?: pino.Logger;
}

/**
 * Abstract base class for API clients.
 *
 * Contains all shared logic: retry loop, timeout handling, input validation,
 * exponential backoff, error logging, and stats tracking.
 *
 * Concrete subclasses implement provider-specific behavior via abstract methods.
 */
export abstract class BaseApiClient implements ApiClient {
  protected config: BaseClientConfig & Record<string, unknown>;
  protected requestCount = 0;
  protected lastError: ApiClientError | null = null;
  protected logger: pino.Logger;

  constructor(config: BaseClientConfig, componentName: string) {
    this.validateConfig(config);
    this.config = {
      maxRetries: 3,
      retryDelay: 1000,
      enableLogging: true,
      ...config,
    };
    this.logger = createLogger({
      enableLogging: this.config.enableLogging as boolean,
      logger: this.config.logger as pino.Logger | undefined,
      component: componentName,
    });
  }

  // --- Subclass hooks ---

  /** Maximum valid temperature value (e.g., 2 for OpenAI, 1 for Anthropic) */
  protected abstract get maxTemperature(): number;

  /** Parse a provider-specific error into a structured ApiClientError */
  protected abstract parseProviderError(
    error: unknown,
    context?: { timeout?: number },
  ): ApiClientError;

  /** Execute the actual API request (called inside retry loop) */
  protected abstract executeApiRequest(
    requestId: string,
    systemPrompt: string,
    workspaceContext: string,
    memoryContext: string[],
    tools: ChatCompletionTool[] | undefined,
  ): Promise<ApiResponse>;

  /**
   * Optional hook for provider-specific debug output after a successful request.
   * Default: no-op.
   */
  protected logDebugInputs(
    _systemPrompt: string,
    _workspaceContext: string,
    _memoryContext: string[],
  ): void {
    // Default: no-op. Subclasses can override for provider-specific debug logging.
  }

  // --- Config validation ---

  private validateConfig(config: BaseClientConfig): void {
    if (!config.apiKey || config.apiKey.trim() === '') {
      throw new ConfigurationError('API key is required', 'apiKey');
    }
    if (!config.model || config.model.trim() === '') {
      throw new ConfigurationError('Model name is required', 'model');
    }
    if (
      config.temperature !== undefined &&
      (config.temperature < 0 || config.temperature > this.maxTemperature)
    ) {
      throw new ConfigurationError(
        `Temperature must be between 0 and ${this.maxTemperature}`,
        'temperature',
      );
    }
    if (config.maxTokens !== undefined && config.maxTokens < 1) {
      throw new ConfigurationError(
        'Max tokens must be greater than 0',
        'maxTokens',
      );
    }
  }

  // --- Main request method (shared retry loop) ---

  async makeRequest(
    systemPrompt: string,
    workspaceContext: string,
    memoryContext: string[],
    timeoutConfig?: ApiTimeoutConfig,
    tools?: ChatCompletionTool[],
  ): Promise<ApiResponse> {
    this.requestCount++;
    const requestId = `req-${this.requestCount}-${Date.now()}`;
    const timeout = timeoutConfig?.timeout ?? 40000;

    this.validateRequestInputs(
      systemPrompt,
      workspaceContext,
      memoryContext,
      tools,
    );

    this.logger.info(
      {
        requestId,
        model: this.config.model,
        timeout,
        messageCount: memoryContext.length + 2,
        hasTools: !!tools && tools.length > 0,
        toolCount: tools?.length ?? 0,
      },
      'Starting request',
    );

    let lastError: ApiClientError | null = null;
    const maxRetries = (this.config.maxRetries as number) ?? 3;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          const delay = this.calculateRetryDelay(attempt);
          this.logger.info(
            { requestId, attempt, maxRetries, delay },
            `Retry attempt ${attempt}/${maxRetries} after ${delay}ms delay`,
          );
          await this.sleep(delay);
        }

        const response = await this.executeApiRequest(
          requestId,
          systemPrompt,
          workspaceContext,
          memoryContext,
          tools,
        );

        this.logDebugInputs(systemPrompt, workspaceContext, memoryContext);
        this.logger.info({ response }, 'Get response successfully');

        this.lastError = null;
        return response;
      } catch (error) {
        const apiError = this.parseProviderError(error, { timeout });
        lastError = apiError;
        this.lastError = apiError;

        this.logger.error(
          {
            requestId,
            attempt: attempt + 1,
            error: apiError.toJSON(),
            isRetryable: apiError.retryable,
            remainingAttempts: maxRetries - attempt,
            config: this.getMaskedConfig(),
          },
          'Request failed on attempt',
        );

        if (!apiError.retryable || attempt >= maxRetries) {
          break;
        }

        if (apiError instanceof RateLimitError && apiError.retryAfter) {
          this.logger.warn(
            { requestId, retryAfter: apiError.retryAfter },
            'Rate limit detected, waiting before retry',
          );
          await this.sleep(apiError.retryAfter * 1000);
        }
      }
    }

    this.logger.error(
      {
        requestId,
        attempts: maxRetries + 1,
        finalError: lastError?.toJSON(),
        config: this.getMaskedConfig(),
      },
      'Request failed after all retry attempts',
    );

    throw lastError ?? new UnknownApiError('Request failed with unknown error');
  }

  // --- Shared utilities ---

  protected validateRequestInputs(
    systemPrompt: string,
    workspaceContext: string,
    memoryContext: string[],
    tools?: ChatCompletionTool[],
  ): void {
    if (typeof systemPrompt !== 'string') {
      throw new ValidationError(
        'System prompt must be a string',
        'systemPrompt',
      );
    }
    if (typeof workspaceContext !== 'string') {
      throw new ValidationError(
        'Workspace context must be a string',
        'workspaceContext',
      );
    }
    if (!Array.isArray(memoryContext)) {
      throw new ValidationError(
        'Memory context must be an array',
        'memoryContext',
      );
    }

    if (tools) {
      if (!Array.isArray(tools)) {
        throw new ValidationError('Tools must be an array', 'tools');
      }
      for (let i = 0; i < tools.length; i++) {
        const tool = tools[i];
        if (
          !tool.type ||
          (tool.type !== 'function' && tool.type !== 'custom')
        ) {
          throw new ValidationError(
            `Tool at index ${i} has invalid type`,
            `tools[${i}].type`,
          );
        }
        if (tool.type === 'function') {
          if (!tool.function?.name) {
            throw new ValidationError(
              `Tool at index ${i} is missing function name`,
              `tools[${i}].function.name`,
            );
          }
        }
      }
    }
  }

  protected calculateRetryDelay(attempt: number): number {
    const baseDelay = (this.config.retryDelay as number) ?? 1000;
    const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
    const jitter = Math.random() * 0.3 * exponentialDelay;
    return Math.min(exponentialDelay + jitter, 30000);
  }

  protected sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Wraps a promise with a timeout using Promise.race.
   * Automatically clears the timeout on resolve/reject.
   */
  protected withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    let timeoutId: NodeJS.Timeout | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(
          new TimeoutError(
            `API request timed out after ${timeoutMs}ms`,
            timeoutMs,
          ),
        );
      }, timeoutMs);
    });
    return Promise.race([promise, timeoutPromise]).finally(() => {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
    });
  }

  public getLastError(): ApiClientError | null {
    return this.lastError;
  }

  public getStats(): {
    requestCount: number;
    lastError: ApiClientError | null;
  } {
    return {
      requestCount: this.requestCount,
      lastError: this.lastError,
    };
  }

  protected getMaskedConfig() {
    return {
      baseURL:
        (this.config.baseURL as string) ?? 'https://api.openai.com/v1',
      apiKey: this.config.apiKey
        ? `${(this.config.apiKey as string).substring(0, 8)}...`
        : undefined,
      model: this.config.model,
      temperature: this.config.temperature,
      maxTokens: this.config.maxTokens,
      maxRetries: this.config.maxRetries,
    };
  }
}
