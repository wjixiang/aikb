/**
 * Exit Instructions Section
 *
 * Provides instructions for exiting the thinking phase.
 */

/**
 * Configuration for exit instructions
 */
export interface ExitInstructionsConfig {
  roundNumber: number;
  maxRounds: number;
  thoughtNumber: number;
  totalThoughts: number;
  retryWarning?: string;
}

/**
 * Generate exit instructions for thinking phase
 */
export function getExitInstructions(config: ExitInstructionsConfig): string {
  const { roundNumber, maxRounds, thoughtNumber, totalThoughts, retryWarning } = config;

  return `====

EXITING THINKING PHASE

When you decide to STOP thinking (continue_thinking with continueThinking=false),
you MUST provide a detailed summary in the same tool call. This summary will be stored as
the official record of this thinking phase and will guide the ACTION phase.

⚠️ IMPORTANT: Your summary should focus ONLY on THIS turn's progress. DO NOT repeat
information that was already covered in previous turns. The previous thinking rounds are
already stored in memory - just summarize what THIS turn accomplished and what needs to
happen next to continue this turn's task.

Current thinking round: ${roundNumber}/${maxRounds}
Current thought number: ${thoughtNumber}
Estimated total thoughts: ${totalThoughts}${retryWarning || ''}`;
}

/**
 * Generate retry warning for thinking phase
 */
export function getRetryWarning(retryAttempt: number, lastError: Error | null): string {
  if (retryAttempt === 0 && !lastError) {
    return '';
  }

  let warning = '';
  if (retryAttempt > 0) {
    warning += `\n\n⚠️ RETRY ATTEMPT ${retryAttempt}: You did not call the required tool. Please call 'continue_thinking' or 'recall_context' to proceed.`;
  }

  if (lastError) {
    warning += `\n\nLast error: ${lastError.message}`;
  }

  return warning;
}
