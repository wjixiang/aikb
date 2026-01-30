import type OpenAI from 'openai';
import { semantic_search } from './semantic_search';
import attempt_completion from './attempt_completion';
import update_workspace from './update_workspace';

export {
  convertOpenAIToolToAnthropic,
  convertOpenAIToolsToAnthropic,
} from './converters';

/**
 * Get native tools array
 *
 * @param partialReadsEnabled - Whether to include line_ranges support in read_file tool (default: true)
 * @returns Array of native tool definitions
 */
export function getNativeTools(
  partialReadsEnabled: boolean = true,
): OpenAI.Chat.ChatCompletionTool[] {
  return [
    semantic_search,
    attempt_completion,
    update_workspace,
  ] satisfies OpenAI.Chat.ChatCompletionTool[];
}

// Backward compatibility: export default tools with line ranges enabled
export const nativeTools = getNativeTools(true);
