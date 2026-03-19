/**
 * Planning Guidance Section
 *
 * Provides the "What to think about" guidance for the thinking phase.
 */

/**
 * Generate planning guidance section
 * This tells the LLM what to focus on during thinking/planning
 */
export function getPlanningGuidance(): string {
  return `====

WHAT TO THINK ABOUT

Think deeply about:
- What the user wants to accomplish (the overall goal)
- What has been accomplished so far
- What needs to be done next (create a step-by-step plan)
- What information is missing
- Whether you need to recall any historical context
- Whether you have enough understanding to take action
- What hypotheses can be formed and how to verify them
- Which Expert (if any) should be activated for this task`;
}
