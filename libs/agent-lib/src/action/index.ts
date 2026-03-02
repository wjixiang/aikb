/**
 * ActionModule - Manages action phase execution
 *
 * This module handles:
 * 1. Making API requests to LLM
 * 2. Executing tool calls
 * 3. Building response messages
 * 4. Tracking token usage and tool statistics
 */

export * from './types.js';
export { ActionModule, defaultActionConfig } from './ActionModule.js';
