import OpenAI from 'openai';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { Tool } from 'stateful-context';

/**
 * Helper function to avoid deep type instantiation in zodToJsonSchema
 * Wraps the call to break the type inference chain
 */
function convertZodToJsonSchema(schema: any): any {
  return zodToJsonSchema(schema, {
    target: 'openApi3',
    $refStrategy: 'none',
  });
}

/**
 * Interface for converting Tool to OpenAI function calling parameters
 */
export interface ToolCallConverter {
  /**
   * Convert a single Tool to OpenAI ChatCompletionTool format
   * @param tool - The Tool interface to convert
   * @returns OpenAI ChatCompletionTool object
   */
  convertTool(tool: Tool): any;

  /**
   * Convert multiple Tools to OpenAI ChatCompletionTool array
   * @param tools - Array of Tool interfaces to convert
   * @returns Array of OpenAI ChatCompletionTool objects
   */
  convertTools(tools: Tool[]): any[];
}

/**
 * Interface for OpenAI function calling request parameters
 */
export interface OpenAIFunctionCallingParams {
  /**
   * The model to use for the request
   */
  model: string;

  /**
   * Array of messages in the conversation
   */
  messages: any[];

  /**
   * Array of tools available for the model to call
   */
  tools?: any[];

  /**
   * Controls which (if any) tool is called by the model
   */
  tool_choice?: any;

  /**
   * Additional optional parameters
   */
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stream?: boolean;
}

/**
 * Default implementation of ToolCallConverter
 * Converts statefulContext Tool interface to OpenAI ChatCompletionTool format
 */
export class DefaultToolCallConverter implements ToolCallConverter {
  convertTool(tool: Tool): any {
    // Convert Zod schema to JSON Schema
    const jsonSchema = convertZodToJsonSchema(tool.paramsSchema);

    // Extract the schema definition (remove $schema property)
    const { $schema, ...parameters } = jsonSchema as any;

    return {
      type: 'function',
      function: {
        name: tool.toolName,
        description: tool.desc,
        parameters: parameters as Record<string, unknown>,
      },
    };
  }

  convertTools(tools: Tool[]): any[] {
    return tools.map(tool => this.convertTool(tool));
  }
}

/**
 * Helper function to create OpenAI function calling parameters from Tools
 * @param tools - Array of Tool interfaces
 * @param messages - Conversation messages
 * @param model - Model name to use
 * @param options - Additional optional parameters
 * @returns Complete OpenAI function calling parameters
 */
export function createOpenAIFunctionCallingParams(
  tools: Tool[],
  messages: any[],
  model: string,
  options?: {
    tool_choice?: any;
    temperature?: number;
    max_tokens?: number;
    top_p?: number;
    frequency_penalty?: number;
    presence_penalty?: number;
    stream?: boolean;
  }
): OpenAIFunctionCallingParams {
  const converter = new DefaultToolCallConverter();

  return {
    model,
    messages,
    tools: converter.convertTools(tools),
    ...options,
  };
}