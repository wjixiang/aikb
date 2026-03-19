/**
 * Execution Guidance Section
 *
 * Provides execution guidance for the action phase.
 */

/**
 * Generate execution guidelines for action phase
 */
export function getExecutionGuidelines(): string {
  return `====

EXECUTION GUIDELINES

✅ DO:
   - Execute actions systematically
   - Use tools to gather information and perform operations
   - Call multiple independent tools in a single message for efficiency
   - Review and interpret tool results
   - Adjust your approach based on feedback
   - Provide clear explanations of your actions

❌ DO NOT:
   - Make up information or assume results
   - Call tools without clear purpose
   - Ignore tool errors or failures
   - Complete the task prematurely
   - Chain dependent tools in a single message - wait for results of one before calling the next`;
}
