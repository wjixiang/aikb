import { zodToJsonSchema } from 'zod-to-json-schema';
import { Tool, ToolExample } from '../types/tool.js';
import {
  ChatCompletionTool,
  FunctionDefinition,
  FunctionParameters,
} from '../types/api-client.js';

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
  convertTool(tool: Tool): ChatCompletionTool;

  /**
   * Convert multiple Tools to OpenAI ChatCompletionTool array
   * @param tools - Array of Tool interfaces to convert
   * @returns Array of OpenAI ChatCompletionTool objects
   */
  convertTools(tools: Tool[]): ChatCompletionTool[];
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
  tools?: ChatCompletionTool[];

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
 * Format tool examples into a description string
 */
function formatExamples(examples: ToolExample[]): string {
  if (!examples || examples.length === 0) {
    return '';
  }

  const formatted = examples.map((ex, idx) => {
    const paramStr = JSON.stringify(ex.params, null, 2);
    const resultStr = ex.expectedResult ? `\nExpected: ${ex.expectedResult}` : '';
    return `Example ${idx + 1}: ${ex.description}\nParameters: ${paramStr}${resultStr}`;
  }).join('\n\n');

  return `\n\n## Examples\n${formatted}`;
}

/**
 * Default implementation of ToolCallConverter
 * Converts statefulContext Tool interface to OpenAI ChatCompletionTool format
 */
export class DefaultToolCallConverter implements ToolCallConverter {
  convertTool(tool: Tool): ChatCompletionTool {
    // Convert Zod schema to JSON Schema
    const jsonSchema = convertZodToJsonSchema(tool.paramsSchema);

    // Extract the schema definition (remove $schema property)
    const { $schema, ...parameters } = jsonSchema as any;

    // Append examples to description if provided
    const description = tool.examples && tool.examples.length > 0
      ? `${tool.desc}${formatExamples(tool.examples)}`
      : tool.desc;

    return {
      type: 'function',
      function: {
        name: tool.toolName,
        description,
        parameters: parameters as FunctionParameters,
      },
    } as ChatCompletionTool;
  }

  convertTools(tools: Tool[]): ChatCompletionTool[] {
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
