import { ToolProtocol } from '../types';

/**
 * Settings passed to system prompt generation functions
 */
export interface SystemPromptSettings {
  toolProtocol?: ToolProtocol;
}
