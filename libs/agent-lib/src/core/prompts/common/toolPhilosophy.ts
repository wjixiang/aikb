/**
 * Tool Philosophy Section - Shared by both Thinking and Action phases
 *
 * This module provides the tool usage philosophy that guides both phases:
 * - Shared philosophy for both phases
 * - Thinking phase specific tool restrictions
 */

import { getToolUseGuidelinesSection } from '../sections/tool-use-guidelines.js';
import { ToolProtocol, TOOL_PROTOCOL } from '../../types/index.js';

/**
 * Generate shared tool philosophy section
 * This is the common understanding of tool usage for both phases
 */
export function getSharedToolPhilosophy(protocol: ToolProtocol = TOOL_PROTOCOL.XML): string {
  return `====

TOOL PHILOSOPHY

Tools are instruments of action - each serves a specific purpose in accomplishing tasks.

1. Assess what information you need and what actions are required to accomplish the task.
2. Choose the most appropriate tool based on the task requirements and tool descriptions.
3. Execute tools with clear understanding of their purpose and expected outcomes.
4. Review results carefully before proceeding to the next step.
5. Adapt your approach based on feedback from tool executions.`;
}

/**
 * Generate thinking phase tool restrictions
 * Thinking phase only allows continue_thinking and recall_context tools
 */
export function getThinkingPhaseToolRestrictions(): string {
  return `====

THINKING PHASE TOOL RESTRICTIONS

During the thinking phase, you can ONLY use these two tools:

✅ 'continue_thinking' - To continue planning or signal you're ready for action phase
✅ 'recall_context' - To recall historical conversation context

🚫 ALL OTHER TOOLS ARE STRICTLY FORBIDDEN 🚫

This includes but is NOT limited to:
❌ NO search tools (search_pubmed, search_database, web_search, etc.)
❌ NO data manipulation tools (set_picos_element, update_record, write_file, etc.)
❌ NO fetch tools (fetch_article, get_data, retrieve_info, etc.)
❌ NO task completion tools (attempt_completion)
❌ NO Expert activation tools (get_expert, activate_expert, list_experts)

This restriction is absolute - no exceptions allowed.`;
}

/**
 * Generate thinking phase full tool guidance
 * Combines shared philosophy with thinking-specific restrictions
 */
export function getThinkingPhaseToolGuidance(protocol: ToolProtocol = TOOL_PROTOCOL.XML): string {
  return `${getSharedToolPhilosophy(protocol)}

${getThinkingPhaseToolRestrictions()}`;
}

/**
 * Generate action phase tool guidance
 * Full access to all tools with guidelines
 */
export function getActionPhaseToolGuidance(protocol: ToolProtocol = TOOL_PROTOCOL.XML): string {
  return `${getSharedToolPhilosophy(protocol)}

${getToolUseGuidelinesSection(protocol)}`;
}
