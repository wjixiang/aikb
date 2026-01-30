import { getAttemptCompletionDescription } from '../attempt-completion';
import attempt_completion from '../native-tools/attempt_completion';
import { Tool, ToolArgs, ToolResponse } from '../types';

export const attempt_completion_tool: Tool = {
  desc: {
    native: attempt_completion,
    xml: getAttemptCompletionDescription,
  },
  resolve: function (args: any): Promise<ToolResponse> {
    throw new Error('Function not implemented.');
  },
};
