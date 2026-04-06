import { injectable } from 'inversify';
import type { Tool } from '../../../components/core/types.js';
import type { IToolProvider } from '../IToolProvider.js';
import { BaseToolProvider } from '../IToolProvider.js';
import type { ToolExecutedCallback } from './ComponentToolProvider.js';
import { attempt_completion } from '../../statefulContext/globalTools.js';

/**
 * Global tool provider
 *
 * Provides always-available global tools:
 * - attempt_completion
 */
@injectable()
export class GlobalToolProvider
  extends BaseToolProvider
  implements IToolProvider
{
  readonly id = 'global-tools';
  readonly priority = 100;

  private tools: Map<string, Tool>;

  private onToolExecuted?: ToolExecutedCallback;

  constructor(onToolExecuted?: ToolExecutedCallback) {
    super();
    this.tools = new Map();
    this.onToolExecuted = onToolExecuted;
    this.initializeTools();
  }

  setOnToolExecuted(callback: ToolExecutedCallback): void {
    this.onToolExecuted = callback;
  }

  private initializeTools(): void {
    const globalTools: Tool[] = [attempt_completion];

    for (const tool of globalTools) {
      this.tools.set(tool.toolName, tool);
    }
  }

  getTools(): Tool[] {
    return Array.from(this.tools.values());
  }

  getTool(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  async executeTool(name: string, params: any): Promise<any> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Global tool not found: ${name}`);
    }

    try {
      let result: any;
      switch (name) {
        case 'attempt_completion': {
          result = this.handleAttemptCompletion(params);
          break;
        }
        default:
          throw new Error(`Unknown global tool: ${name}`);
      }

      const isSuccess = result?.success !== false;

      if (this.onToolExecuted) {
        this.onToolExecuted(name, params, result, isSuccess, 'global');
      }

      return result;
    } catch (error) {
      if (this.onToolExecuted) {
        this.onToolExecuted(
          name,
          params,
          error instanceof Error ? error.message : String(error),
          false,
          'global',
        );
      }

      throw error;
    }
  }

  private handleAttemptCompletion(_params: any): {
    success: boolean;
    completed: boolean;
  } {
    return {
      success: true,
      completed: true,
    };
  }

  hasTool(name: string): boolean {
    return this.tools.has(name);
  }

  getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }
}
