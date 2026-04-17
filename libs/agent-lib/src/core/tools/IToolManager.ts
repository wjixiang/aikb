import type { Tool } from '../../components/core/types.js';

export interface ToolDefinition {
  tool: Tool;
  handler: (params: any) => Promise<any>;
  componentKey?: string;
}

export interface IToolManager {
  registerTool(definition: ToolDefinition): void;
  unregisterTool(toolName: string): boolean;
  getAllTools(): ToolDefinition[];
  getAvailableTools(): Tool[];
  executeTool(name: string, params: any): Promise<any>;
  getToolSource(name: string): { componentKey?: string } | null;
  getTool(nameName: string): ToolDefinition | undefined;
  hasTool(toolName: string): boolean;
}
