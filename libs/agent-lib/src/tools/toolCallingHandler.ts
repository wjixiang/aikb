import { ToolName } from '../types';
import { toolSet } from '.';

export class ToolCallingHandler {
  async handleToolCalling(toolName: ToolName, param: any) {
    const tool = toolSet.get(toolName);
    const toolCallResult = tool?.resolve(param);
    return toolCallResult;
  }
}
