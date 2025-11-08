import type { ToolDefinition, ToolResult, ToolParameter } from '@/types/baml';
import * as get_forecast from './tools/get_weather_tool';

// Define a type for our tool handlers
export type ToolHandler = (args: any) => Promise<any>;

// Define our tool registry entry
export interface RegisteredTool {
  meta: ToolDefinition;
  run: ToolHandler;
}

// Convert existing tool meta to BAML ToolDefinition format
function convertToBamlToolDefinition(meta: any): ToolDefinition {
  // Extract parameters from the existing format
  const parameters: ToolParameter[] = [];
  const required_parameters: string[] = [];

  if (meta.parameters && meta.parameters.properties) {
    for (const [key, value] of Object.entries(meta.parameters.properties)) {
      parameters.push({
        name: key,
        type: (value as any).type || 'string',
        description: (value as any).description || '',
        required: meta.parameters.required?.includes(key) || false,
      });

      if (meta.parameters.required?.includes(key)) {
        required_parameters.push(key);
      }
    }
  }

  return {
    name: meta.name,
    description: meta.description,
    parameters,
    required_parameters,
  };
}

// Tool registry class
export class ToolRegistry {
  private registry: Map<string, RegisteredTool> = new Map();

  constructor() {
    // Register default tools
    const bamlMeta = convertToBamlToolDefinition(get_forecast.meta);
    this.registerTool(bamlMeta, get_forecast.run);
  }

  // Register a new tool
  registerTool(meta: ToolDefinition, handler: ToolHandler): void {
    this.registry.set(meta.name, { meta, run: handler });
  }

  // Get a tool by name
  getTool(name: string): RegisteredTool | undefined {
    return this.registry.get(name);
  }

  // List all available tools
  listTools(): ToolDefinition[] {
    return Array.from(this.registry.values()).map((t) => t.meta);
  }

  // Execute a tool by name with parameters
  async executeTool(name: string, parameters: any): Promise<ToolResult> {
    const tool = this.getTool(name);

    if (!tool) {
      return {
        tool_id: name,
        result: '',
        success: false,
        error_message: `Tool ${name} not found`,
      };
    }

    try {
      const result = await tool.run(parameters);
      return {
        tool_id: name,
        result: JSON.stringify(result),
        success: true,
      };
    } catch (error) {
      return {
        tool_id: name,
        result: '',
        success: false,
        error_message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

// Create a singleton instance
export const toolRegistry = new ToolRegistry();
