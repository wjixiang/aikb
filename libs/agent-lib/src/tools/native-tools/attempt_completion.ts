import type OpenAI from 'openai';

const ATTEMPT_COMPLETION_DESCRIPTION = `After each research tool use, the user will respond with the result of that analysis, i.e. if it succeeded or failed, along with any reasons for failure. Once you've received the results of research analyses and can confirm that the medical investigation is complete, use this tool to present the findings to the user. The user may respond with feedback if they are not satisfied with the research results, which you can use to make improvements and try again.

IMPORTANT NOTE: This tool CANNOT be used until you've confirmed from the user that any previous research tool uses were successful. Failure to do so will result in invalid research conclusions. Before using this tool, you must confirm that you've received successful results from the user for any previous research analyses. If not, then DO NOT use this tool.

Parameters:
- result: (required) The result of the medical research task. Formulate this result in a way that is final and does not require further input from the user. Don't end your result with questions or offers for further assistance.

Example: Completing after literature analysis
{ "result": "I've analyzed 15 clinical studies on the treatment efficacy, finding that the intervention shows statistically significant improvement in patient outcomes with minimal adverse effects." }`;

const RESULT_PARAMETER_DESCRIPTION = `Final research findings message to deliver to the user once the medical investigation is complete`;

export default {
  type: 'function',
  function: {
    name: 'attempt_completion',
    description: ATTEMPT_COMPLETION_DESCRIPTION,
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        result: {
          type: 'string',
          description: RESULT_PARAMETER_DESCRIPTION,
        },
      },
      required: ['result'],
      additionalProperties: false,
    },
  },
} satisfies OpenAI.Chat.ChatCompletionTool;
