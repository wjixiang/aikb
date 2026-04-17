import { injectable, inject } from 'inversify';
import type { Tool } from '../../components/core/types.js';
import type { IToolManager, ToolDefinition } from './IToolManager.js';
import { ToolNotFoundError } from './tool.errors.js';
import { TYPES } from '../di/types.js';
import { HookType } from '../hooks/types.js';
import type { HookModule } from '../hooks/HookModule.js';
import { getLogger } from '@shared/logger';

@injectable()
export class ToolManager implements IToolManager {
  private registry: Map<string, ToolDefinition>;
  private hookModule: HookModule;
  private instanceId: string;
  private logger = getLogger('ToolManager');

  constructor(
    @inject(TYPES.HookModule) hookModule: HookModule,
    @inject(TYPES.AgentInstanceId) instanceId: string,
  ) {
    this.registry = new Map();
    this.hookModule = hookModule;
    this.instanceId = instanceId;
  }

  registerTool(definition: ToolDefinition): void {
    const { tool } = definition;
    if (this.registry.has(tool.toolName)) {
      this.logger.warn(`Tool "${tool.toolName}" already registered, overwriting`);
    }
    this.registry.set(tool.toolName, definition);
  }

  unregisterTool(toolName: string): boolean {
    return this.registry.delete(toolName);
  }

  getAllTools(): ToolDefinition[] {
    return Array.from(this.registry.values());
  }

  getAvailableTools(): Tool[] {
    return Array.from(this.registry.values()).map((d) => d.tool);
  }

  async executeTool(name: string, params: any): Promise<any> {
    const definition = this.registry.get(name);
    if (!definition) {
      throw new ToolNotFoundError(name);
    }

    const componentId = definition.componentKey;
    const startTime = Date.now();
    let result: any;
    let success = true;
    let error: Error | undefined;

    await this.hookModule.executeHooks(HookType.TOOL_BEFORE_EXECUTE, {
      type: HookType.TOOL_BEFORE_EXECUTE,
      timestamp: new Date(),
      instanceId: this.instanceId,
      toolName: name,
      params,
      componentId,
    });

    try {
      result = await definition.handler(params);
      return result;
    } catch (e) {
      success = false;
      error = e instanceof Error ? e : new Error(String(e));
      throw e;
    } finally {
      await this.hookModule.executeHooks(HookType.TOOL_AFTER_EXECUTE, {
        type: HookType.TOOL_AFTER_EXECUTE,
        timestamp: new Date(),
        instanceId: this.instanceId,
        toolName: name,
        params,
        result,
        success,
        error,
        componentId,
        duration: Date.now() - startTime,
      });
    }
  }

  getToolSource(name: string): { componentKey?: string } | null {
    const definition = this.registry.get(name);
    if (!definition) {
      return null;
    }
    return { componentKey: definition.componentKey };
  }

  getTool(toolName: string): ToolDefinition | undefined {
    return this.registry.get(toolName);
  }

  hasTool(toolName: string): boolean {
    return this.registry.has(toolName);
  }
}
