import type { ToolName, ModeConfig } from '../types';
import OpenAI from 'openai';

import { ToolArgs } from './types';
import { getSemanticSearchDescription } from './semantic-search';
import attempt_completion from './native-tools/attempt_completion';
import { getAttemptCompletionDescription } from './attempt-completion';
import { convertOpenAIToolToAnthropic } from './native-tools';

import { Tool } from './types';
import { semantic_search_tool } from './tools/semantic_search';
import { ToolCallingHandler } from './toolCallingHandler';
import { getNativeTools } from './native-tools';

// Export tool errors
export * from './tool.errors';

export const toolSet = new Map<ToolName, Tool>();

function registerTools() {
  toolSet.set('semantic_search', semantic_search_tool);
  toolSet.set('attempt_completion', {
    desc: {
      native: attempt_completion,
      xml: (args) => getAttemptCompletionDescription(args),
    },
    resolve: async (args: any) => {
      // For attempt_completion, just return a success message
      return 'Task completed successfully';
    },
  });
}
registerTools();

// Map of tool names to their description functions
const toolDescriptionMap: Record<
  string,
  (args: ToolArgs) => string | undefined
> = {
  semantic_search: (args) => getSemanticSearchDescription(args),
  attempt_completion: (args) => getAttemptCompletionDescription(args),
};

export function getToolDescriptions(
  // mode: Mode,
  settings?: Record<string, any>,
  modelId?: string,
): string {
  // const config = getModeConfig(mode);
  const args: ToolArgs = {
    settings: {
      ...settings,
      modelId,
    },
  };

  const tools = new Set<string>();

  // Map tool descriptions for allowed tools
  const descs = Array.from(toolSet.values()).map(e => {
    return e.desc.xml
  })



  return `# Tools\n\n${descs.join('\n\n')}`;
}

/**
 * Get native tool descriptions for native protocol
 * Returns formatted tool descriptions in text format for system prompt
 */
export function getNativeToolDescriptions(): string {
  const nativeTools = getNativeTools();

  const descriptions = nativeTools.map(tool => {
    if (tool.type !== 'function') return '';

    const toolDef = tool.function;
    let desc = `## ${toolDef.name}\n\n${toolDef.description}\n\n`;

    // Add parameters if they exist
    const params = toolDef.parameters as any;
    if (params && params['properties']) {
      desc += `Parameters:\n`;
      for (const [paramName, paramDef] of Object.entries(params['properties'])) {
        const param = paramDef as any;
        const required = Array.isArray(params['required']) && params['required'].includes(paramName) ? ' (required)' : ' (optional)';
        desc += `- **${paramName}**${required}: ${param.description}\n`;
      }
    }

    return desc;
  });

  return `# Available Tools\n\n${descriptions.join('\n\n')}`;
}

export { ToolCallingHandler };

// Export native tool definitions (JSON schema format for OpenAI-compatible APIs)
export { nativeTools } from './native-tools';
export {
  convertOpenAIToolToAnthropic,
  convertOpenAIToolsToAnthropic,
} from './native-tools/converters';
