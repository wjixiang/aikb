/**
 * Converts OpenAI tool format to Anthropic tool format
 */

export interface OpenAITool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters?: any;
  };
}

export interface AnthropicTool {
  name: string;
  description: string;
  input_schema?: any;
}

/**
 * Converts an array of OpenAI tools to Anthropic format
 */
export function convertOpenAIToolsToAnthropic(
  tools: OpenAITool[],
): AnthropicTool[] {
  if (!tools || !Array.isArray(tools)) {
    return [];
  }

  return tools
    .filter((tool) => tool.type === 'function' && tool.function)
    .map((tool) => ({
      name: tool.function.name,
      description: tool.function.description,
      input_schema: tool.function.parameters,
    }));
}
