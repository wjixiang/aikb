import 'reflect-metadata';
import { injectable, inject } from 'inversify';
import { ToolComponent, type ToolCallResult } from 'agent-lib/components';
import { tdiv } from 'agent-lib/components/ui';
import { TYPES } from 'agent-lib/core';
import { z } from 'zod';

@injectable()
export class LifecycleComponent extends ToolComponent {
  override componentId = 'lifecycle';
  override displayName = 'Lifecycle Management';
  override description = 'Task completion and lifecycle control';
  override componentPrompt = `## Lifecycle Management

You have access to lifecycle management tools for completing tasks.

**Available Tools:**
- attempt_completion: Complete the task and return final result

**Best Practices:**
- Call attempt_completion when your task is fully accomplished
- Provide clear, concise final results
- The agent will stop processing after attempt_completion is called`;

  protected instanceId: string;

  constructor(@inject(TYPES.AgentInstanceId) instanceId: string) {
    super();
    this.instanceId = instanceId;
  }

  protected toolDefs() {
    return {
      attempt_completion: {
        desc: 'Complete the task and return final result to the user. This MUST be called when the task is fully accomplished.',
        paramsSchema: z.object({
          result: z
            .string()
            .describe('The final result message to present to the user'),
        }),
      },
    };
  }

  renderImply = async () => {
    return [
      new tdiv({
        content:
          '## Lifecycle Management\n\nTask completion and agent lifecycle control.',
        styles: { width: 80 },
      }),
    ];
  };

  async onAttemptCompletion(params: {
    result: string;
  }): Promise<ToolCallResult<{ result: string }>> {
    const result = typeof params.result === 'string' ? params.result : '';

    return {
      success: true,
      data: { result },
      summary: `[Lifecycle] Task completed`,
    };
  }
}
