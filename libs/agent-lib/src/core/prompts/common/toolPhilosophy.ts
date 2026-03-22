/**
 * Tool Philosophy Section
 *
 * This module provides the tool usage philosophy for the Action phase.
 */

import { getToolUseGuidelinesSection } from '../sections/tool-use-guidelines.js';
import { ToolProtocol, TOOL_PROTOCOL } from '../../types/index.js';

/**
 * Generate shared tool philosophy section
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
 * Generate action phase tool guidance
 * Full access to all tools with guidelines
 */
export function getActionPhaseToolGuidance(protocol: ToolProtocol = TOOL_PROTOCOL.XML): string {
  return `${getSharedToolPhilosophy(protocol)}

${getToolUseGuidelinesSection(protocol)}`;
}
