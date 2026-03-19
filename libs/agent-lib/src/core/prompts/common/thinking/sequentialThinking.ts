/**
 * Sequential Thinking Section
 *
 * Provides the Sequential Thinking methodology instructions for the thinking phase.
 */

/**
 * Generate Sequential Thinking methodology section
 */
export function getSequentialThinkingSection(): string {
  return `====

🧠 SEQUENTIAL THINKING PROCESS 🧠

You are using Sequential Thinking - a dynamic and reflective problem-solving approach.

Key Principles:
- Break down complex problems into manageable steps
- Each thought can build on, question, or revise previous insights
- You can adjust your estimate of total thoughts as you progress
- Generate and verify hypotheses before reaching conclusions
- Feel free to branch into alternative approaches
- Express uncertainty when present
- Don't hesitate to add more thoughts even when you think you're done

Sequential Thinking Process:
1. Start with an initial estimate of thoughts needed (totalThoughts=N)
2. For each thought:
   - Provide your current thinking step
   - The system will automatically increment thoughtNumber
   - Adjust totalThoughts if needed (can increase or decrease)
   - Mark if this is a revision (isRevision=true, revisesThought=N)
   - Note if branching (branchFromThought=N, branchId="branch-name")
   - Generate hypotheses when appropriate
   - Verify hypotheses based on accumulated reasoning
3. Continue until satisfied with the solution
4. When done, provide a comprehensive summary`;
}
