import { ToolName } from '../types';
import { toolSet, ToolContext } from '.';
import {
  ToolNotFoundError,
  ToolExecutionError,
  ToolTimeoutError,
} from './tool.errors';

/**
 * Configuration for tool execution
 */
export interface ToolExecutionConfig {
  timeout?: number; // Timeout in milliseconds
  context?: ToolContext; // Context to pass to tool execution
}

export class ToolCallingHandler {
  private readonly defaultTimeout: number = 30000; // 30 seconds default

  async handleToolCalling(
    toolName: ToolName,
    param: any,
    config?: ToolExecutionConfig,
  ) {
    const tool = toolSet.get(toolName);

    // Check if tool exists
    if (!tool) {
      throw new ToolNotFoundError(toolName);
    }

    const timeout = config?.timeout ?? this.defaultTimeout;

    try {
      // Execute tool with timeout
      const toolCallResult = await this.executeWithTimeout(
        () => tool.resolve(param, config?.context),
        timeout,
        toolName,
      );
      return toolCallResult;
    } catch (error) {
      // Re-throw tool errors as-is
      if (
        error instanceof ToolNotFoundError ||
        error instanceof ToolExecutionError ||
        error instanceof ToolTimeoutError
      ) {
        throw error;
      }

      // Wrap other errors in ToolExecutionError
      throw new ToolExecutionError(
        toolName,
        error instanceof Error ? error.message : String(error),
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Execute a function with timeout
   */
  private async executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number,
    toolName: string,
  ): Promise<T> {
    return Promise.race([
      fn(),
      this.createTimeoutPromise(timeoutMs, toolName),
    ]);
  }

  /**
   * Create a timeout promise
   */
  private createTimeoutPromise<T>(timeoutMs: number, toolName: string): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new ToolTimeoutError(toolName, timeoutMs));
      }, timeoutMs);
    });
  }
}
