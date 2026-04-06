import 'reflect-metadata';
import { injectable, inject } from 'inversify';
import { ToolComponent, type ToolCallResult } from 'agent-lib/components';
import { tdiv } from 'agent-lib/components/ui';
import { TYPES } from 'agent-lib/core';
import type { IAgentSleepControl } from 'agent-lib/core';
import { z } from 'zod';

export interface WakeUpData {
  conversationId: string;
  messageType: string;
  from: string;
  content: unknown;
}

@injectable()
export class LifecycleComponent extends ToolComponent {
  override componentId = 'lifecycle';
  override displayName = 'Lifecycle Management';
  override description = 'Task completion and lifecycle control';

  protected instanceId: string;
  private sleepControl: IAgentSleepControl;

  constructor(
    @inject(TYPES.AgentInstanceId) instanceId: string,
    @inject(TYPES.AgentSleepControl) sleepControl: IAgentSleepControl,
  ) {
    super();
    this.instanceId = instanceId;
    this.sleepControl = sleepControl;
  }

  override get componentPrompt(): string {
    return `## Lifecycle Management

You have access to lifecycle management tools for completing tasks and saving state.

**Available Tools:**
- attempt_completion: Complete the task and return final result
- sleep: Save current state and enter sleep mode (agent will be restored when needed)

**Best Practices:**
- Call attempt_completion when your task is fully accomplished
- Call sleep when you want to save progress and pause (the runtime will restore you later)
- The agent will stop processing after attempt_completion is called`;
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
      sleep: {
        desc: 'Pause execution and wait for an external event to wake you up. Returns the wake-up data when triggered.',
        paramsSchema: z.object({
          reason: z
            .string()
            .optional()
            .describe('Reason for sleeping (for observability)'),
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

  async onSleep(params: {
    reason?: string;
  }): Promise<ToolCallResult<WakeUpData>> {
    const reason = params.reason ?? 'waiting for event';

    try {
      await this.sleepControl.sleep(reason);

      return {
        success: true,
        data: {
          conversationId: '',
          messageType: 'response',
          from: '',
          content: { status: 'sleeping', reason },
        } as WakeUpData,
        summary: `[Lifecycle] Agent entered sleep state: ${reason}`,
      };
    } catch (error) {
      return {
        success: false,
        data: {
          conversationId: '',
          messageType: 'error',
          from: '',
          content: error instanceof Error ? error.message : String(error),
        } as WakeUpData,
        summary: `[Lifecycle] Sleep error: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }
  }
}
