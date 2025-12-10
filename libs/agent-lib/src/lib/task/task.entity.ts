import { TokenUsage } from '../types/message.type';
import { ToolUsage } from '../types/tool.type';
import Anthropic from '@anthropic-ai/sdk';

export class Task {
  readonly taskId: string;
  private _status: 'running' | 'completed' | 'aborted' = 'running';

  constructor(taskId: string) {
    this.taskId = taskId;
  }

  start() {
    this._status = 'running';
    return { event: 'task.started', data: { taskId: this.taskId } };
  }

  complete(tokenUsage: TokenUsage, toolUsage: ToolUsage) {
    this._status = 'completed';
    return {
      event: 'task.completed',
      data: { taskId: this.taskId, tokenUsage, toolUsage },
    };
  }

  abort() {
    this._status = 'aborted';
    return { event: 'task.aborted', data: { taskId: this.taskId } };
  }

  private async initiateTaskLoop(
    userContent: Anthropic.Messages.ContentBlockParam[],
  ): Promise<void> {
    // Kicks off the checkpoints initialization process in the background.
    // getCheckpointService(this)

    let nextUserContent = userContent;
    let includeFileDetails = true;

    this.emit(RooCodeEventName.TaskStarted);

    while (!this.abort) {
      const didEndLoop = await this.recursivelyMakeClineRequests(
        nextUserContent,
        includeFileDetails,
      );
      includeFileDetails = false; // We only need file details the first time.

      // The way this agentic loop works is that cline will be given a
      // task that he then calls tools to complete. Unless there's an
      // attempt_completion call, we keep responding back to him with his
      // tool's responses until he either attempt_completion or does not
      // use anymore tools. If he does not use anymore tools, we ask him
      // to consider if he's completed the task and then call
      // attempt_completion, otherwise proceed with completing the task.
      // There is a MAX_REQUESTS_PER_TASK limit to prevent infinite
      // requests, but Cline is prompted to finish the task as efficiently
      // as he can.

      if (didEndLoop) {
        // For now a task never 'completes'. This will only happen if
        // the user hits max requests and denies resetting the count.
        break;
      } else {
        const modelInfo = this.api.getModel().info;
        const state = await this.providerRef.deref()?.getState();
        const toolProtocol = resolveToolProtocol(
          this.apiConfiguration,
          modelInfo,
        );
        nextUserContent = [
          { type: 'text', text: formatResponse.noToolsUsed(toolProtocol) },
        ];
        this.consecutiveMistakeCount++;
      }
    }
  }
}
