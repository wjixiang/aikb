import { ToolProtocol, isNativeProtocol, TOOL_PROTOCOL } from '../../types';

/**
 * Simplified response formatting utilities
 * Extracted from core/prompts/responses.ts
 */
export const formatResponse = {
  toolDenied: (protocol?: ToolProtocol) => {
    if (isNativeProtocol(protocol ?? TOOL_PROTOCOL.XML)) {
      return JSON.stringify({
        status: 'denied',
        message: 'The user denied this operation.',
      });
    }
    return `The user denied this operation.`;
  },

  toolError: (error?: string, protocol?: ToolProtocol) => {
    if (isNativeProtocol(protocol ?? TOOL_PROTOCOL.XML)) {
      return JSON.stringify({
        status: 'error',
        message: 'The tool execution failed',
        error: error,
      });
    }
    return `The tool execution failed with the following error:\n<error>\n${error}\n</error>`;
  },

  noToolsUsed: (protocol?: ToolProtocol) => {
    const instructions = getToolInstructionsReminder(protocol);

    return `[ERROR] You did not use a tool in your previous response! Please retry with a tool use.

${instructions}

# Next Steps

If you have completed the user's task, use attempt_completion tool.
If you require additional information from the user, use the ask_followup_question tool.
Otherwise, if you have not completed the task and do not need additional information, then proceed with the next step of your task.
(This is an automated message, so do not respond to it conversationally.)`;
  },

  tooManyMistakes: (feedback?: string, protocol?: ToolProtocol) => {
    if (isNativeProtocol(protocol ?? TOOL_PROTOCOL.XML)) {
      return JSON.stringify({
        status: 'guidance',
        message: 'You seem to be having trouble proceeding',
        feedback: feedback,
      });
    }
    return `You seem to be having trouble proceeding. The user has provided the following feedback to help guide you:\n<feedback>\n${feedback}\n</feedback>`;
  },

  missingToolParameterError: (paramName: string, protocol?: ToolProtocol) => {
    const instructions = getToolInstructionsReminder(protocol);

    return `Missing value for required parameter '${paramName}'. Please retry with complete response.\n\n${instructions}`;
  },

  toolResult: (
    text: string,
    images?: string[],
  ): string | Array<any> => {
    if (images && images.length > 0) {
      const textBlock = { type: 'text', text };
      const imageBlocks = images.map(dataUrl => {
        // data:image/png;base64,base64string
        const [rest, base64] = dataUrl.split(',');
        const mimeType = rest.split(':')[1].split(';')[0];
        return {
          type: 'image',
          source: { type: 'base64', media_type: mimeType, data: base64 },
        };
      });
      // Placing images after text leads to better results
      return [textBlock, ...imageBlocks];
    } else {
      return text;
    }
  },
};

const toolUseInstructionsReminder = `# Reminder: Instructions for Tool Use

Tool uses are formatted using XML-style tags. The tool name itself becomes the XML tag name. Each parameter is enclosed within its own set of tags. Here's the structure:

<actual_tool_name>
<parameter1_name>value1</parameter1_name>
<parameter2_name>value2</parameter2_name>
...
</actual_tool_name>

For example, to use attempt_completion tool:

<attempt_completion>
<result>
I have completed the task...
</result>
</attempt_completion>

Always use the actual tool name as the XML tag name for proper parsing and execution.`;

const toolUseInstructionsReminderNative = `# Reminder: Instructions for Tool Use

Tools are invoked using the platform's native tool calling mechanism. Each tool requires specific parameters as defined in tool descriptions. Refer to the tool definitions provided in your system instructions for correct parameter structure and usage examples.

Always ensure you provide all required parameters for the tool you wish to use.`;

/**
 * Gets appropriate tool use instructions reminder based on the protocol.
 *
 * @param protocol - Optional tool protocol, defaults to XML if not provided
 * @returns The tool use instructions reminder text
 */
function getToolInstructionsReminder(protocol?: ToolProtocol): string {
  const effectiveProtocol = protocol ?? TOOL_PROTOCOL.XML;
  return isNativeProtocol(effectiveProtocol)
    ? toolUseInstructionsReminderNative
    : toolUseInstructionsReminder;
}