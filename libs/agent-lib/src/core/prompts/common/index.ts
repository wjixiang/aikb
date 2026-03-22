/**
 * Common Prompt Modules
 *
 * Shared components used by Action phase.
 */

// Base instruction
export { getBaseInstruction } from './baseInstruction.js';
export type { BaseInstructionConfig } from './baseInstruction.js';

// Tool philosophy
export {
  getSharedToolPhilosophy,
  getActionPhaseToolGuidance,
} from './toolPhilosophy.js';

// Restrictions
export {
  getSharedRestrictions,
  getExpertPromptOverrideWarning,
} from './restrictions.js';

// Action phase modules
export { getExecutionGuidelines } from './action/index.js';
