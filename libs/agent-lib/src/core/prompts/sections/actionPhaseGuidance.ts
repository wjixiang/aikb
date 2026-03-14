
/**
 * Action Phase Guidance Section
 *
 * Provides instructions for the LLM to follow the thinking phase's plan
 * during the action phase execution.
 */

/**
 * Generate action phase guidance section
 *
 * This section tells the LLM to:
 * 1. Follow the plan generated during the thinking phase
 * 2. Execute the planned actions step by step
 * 3. Use the available tools to accomplish the tasks
 * 4. Report progress and results
 *
 * @param thinkingSummary - Optional summary from the thinking phase
 * @returns Formatted string for the prompt
 */
export function generateActionPhaseGuidance(thinkingSummary?: string): string {
   const thinkingGuidance = thinkingSummary
      ? `
╔══════════════════════════════════════════════════════════════════════════════╗
║                      📋 THINKING PHASE PLAN 📋                                   ║
╚══════════════════════════════════════════════════════════════════════════════╝

The thinking phase has generated a plan for you to follow:

${thinkingSummary}

╔══════════════════════════════════════════════════════════════════════════════╗
║                        ⚠️ ACTION PHASE GUIDANCE ⚠️                              ║
╚══════════════════════════════════════════════════════════════════════════════╝

You are now in the ACTION phase. Your primary responsibility is to EXECUTE the plan
that was generated during the thinking phase.

════════════════════════════════════════════════════════════════════════════════
                              YOUR INSTRUCTIONS
════════════════════════════════════════════════════════════════════════════════

1. 📋 FOLLOW THE PLAN
   - Review the thinking phase plan above
   - Execute the actions in the order specified
   - Each action should build on the previous results

2. 🛠️ USE MULTIPLE TOOLS IN ONE MESSAGE
   - Use the tools listed in the TOOL BOX section
   - You can call MULTIPLE tools in a SINGLE message when appropriate
   - This is much more efficient than calling them one at a time
   - Only use this for independent tools that don't depend on each other's results
   - Choose the appropriate tool for each step
   - Provide clear and accurate parameters

3. 📊 REPORT PROGRESS
   - After tool execution, review the results
   - If a tool call fails, analyze why and retry if appropriate
   - Keep track of what has been accomplished

4. 🔄 ADAPT IF NEEDED
   - If the plan encounters unexpected issues, adapt your approach
   - You can deviate from the plan if circumstances require it
   - Explain your reasoning when deviating

5. ✅ COMPLETE THE TASK
   - Continue executing until the task is complete
   - Call 'attempt_completion' when you have successfully completed the task
   - Provide a clear summary of what was accomplished

════════════════════════════════════════════════════════════════════════════════
                            EXECUTION GUIDELINES
════════════════════════════════════════════════════════════════════════════════

✅ DO:
   - Execute the planned actions systematically
   - Use tools to gather information and perform operations
   - Call multiple independent tools in a single message for efficiency
   - Review and interpret tool results
   - Adjust your approach based on feedback
   - Provide clear explanations of your actions

❌ DO NOT:
   - Skip steps in the plan without good reason
   - Make up information or assume results
   - Call tools that weren't planned without justification
   - Ignore tool errors or failures
   - Complete the task prematurely
   - Chain dependent tools in a single message - wait for results of one before calling the next

════════════════════════════════════════════════════════════════════════════════
                              RESPONSE FORMAT
════════════════════════════════════════════════════════════════════════════════

For each action:
1. Briefly explain what you're about to do
2. Call ONE or MORE tools (if independent) with correct parameters
3. Wait for and review all tool results
4. Proceed to the next step or adjust as needed

When you have completed all planned actions:
1. Call 'attempt_completion' with a summary of results
2. Provide clear confirmation that the task is complete

`
      : `
╔══════════════════════════════════════════════════════════════════════════════╗
║                        ⚠️ ACTION PHASE GUIDANCE ⚠️                              ║
╚══════════════════════════════════════════════════════════════════════════════╝

You are now in the ACTION phase. Your responsibility is to EXECUTE actions to
accomplish the user's task.

════════════════════════════════════════════════════════════════════════════════
                              YOUR INSTRUCTIONS
════════════════════════════════════════════════════════════════════════════════

1. 🎯 ACCOMPLISH THE TASK
   - Understand what the user wants to achieve
   - Use available tools to complete the task
   - Work systematically toward the goal

2. 🛠️ USE MULTIPLE TOOLS IN ONE MESSAGE
   - Use the tools listed in the TOOL BOX section
   - You can call MULTIPLE tools in a SINGLE message when appropriate
   - This is much more efficient than calling them one at a time
   - Only use this for independent tools that don't depend on each other's results
   - Choose the appropriate tool for each action
   - Provide clear and accurate parameters

3. 📊 REPORT PROGRESS
   - After tool execution, review the results
   - If a tool call fails, analyze why and retry if appropriate
   - Keep track of what has been accomplished

4. ✅ COMPLETE THE TASK
   - Continue executing until the task is complete
   - Call 'attempt_completion' when you have successfully completed the task
   - Provide a clear summary of what was accomplished

════════════════════════════════════════════════════════════════════════════════
                            EXECUTION GUIDELINES
════════════════════════════════════════════════════════════════════════════════

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
   - Chain dependent tools in a single message - wait for results of one before calling the next

`;

   return thinkingGuidance;
}

