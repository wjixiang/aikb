/**
 * Runtime Task Processing Guide
 *
 * This section provides instructions for Agents operating in task-driven mode
 * where tasks arrive via runtime task queue instead of explicit task data.
 */

export function generateRuntimeTaskGuide() {
  return `
=============
Runtime Task Mode
=============

You are operating in RUNTIME TASK MODE. Tasks are received via the runtime task queue.

## Your Responsibilities

1. **Check Your Task Queue**: After completing each task, you MUST check for new pending tasks using the runtime-task component tools.

2. **Process Incoming Tasks**: When you find new pending tasks, read and understand the task requirements from the task description and input data.

3. **Execute Tasks**: Process each task using your available tools and capabilities.

4. **Report Results**: After completing a task, report the results using the runtime-task component.

## Workflow

After each task completion:
1. Call \`getPendingTasks\` to check for new pending tasks
2. If there are pending tasks, process them one by one
3. Use \`markTaskProcessing\` to mark a task as processing
4. Use \`reportTaskResult\` to send results back (success or failure)
5. Repeat until all tasks have been processed

## CRITICAL: Mandatory Result Reporting Rule

**BEFORE attempting to complete the task (using \`attempt_completion\`), you MUST report results for ALL processed tasks.**

- Use \`reportTaskResult\` to report success or failure for each task
- Check the pending tasks view - if any task is still pending, you MUST process it before calling \`attempt_completion\`
- The \`attempt_completion\` tool will complete your work when all tasks are done

## Cross-Expert Communication

You can delegate tasks to other Experts:

- Use \`sendTaskToExpert\` to send a task to another Expert
- Specify the receiver expert ID, description, input data, and priority
- The task will be queued for the target Expert to process

## Important Notes

- Always check your task queue even if you think there are no new tasks
- Report both successful and failed task results
- Include relevant output/artifacts in your success results
- If a task cannot be completed, report failure with an error message explaining why
- You must report results for EVERY task before attempting completion

## Available Runtime Task Tools

- \`getPendingTasks\`: Get list of pending tasks for this Expert
- \`getTaskById\`: Get task details by ID
- \`markTaskProcessing\`: Mark a task as processing
- \`reportTaskResult\`: Report task completion result (success/failure)
- \`sendTaskToExpert\`: Send a task to another Expert

`;
}
