/**
 * Common Prompt Modules
 *
 * Shared components used by both Thinking and Action phases.
 */

// Base instruction
export { getBaseInstruction } from './baseInstruction.js';
export type { BaseInstructionConfig } from './baseInstruction.js';

// Tool philosophy
export {
  getSharedToolPhilosophy,
  getThinkingPhaseToolRestrictions,
  getThinkingPhaseToolGuidance,
  getActionPhaseToolGuidance,
} from './toolPhilosophy.js';

// Restrictions
export {
  getSharedRestrictions,
  getThinkingPhaseRestrictions,
  getExpertPromptOverrideWarning,
} from './restrictions.js';

// Thinking phase modules
export {
  getSequentialThinkingSection,
  getPlanningGuidance,
  getExitInstructions,
  getRetryWarning,
} from './thinking/index.js';
export type { ExitInstructionsConfig } from './thinking/index.js';

// Action phase modules
export { getExecutionGuidelines } from './action/index.js';
