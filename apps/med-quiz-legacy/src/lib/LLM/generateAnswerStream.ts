import { HTTPRequest } from '@boundaryml/baml';
import { SupportedLLM, get_provider } from './LLMProvider';

/**
 * Generates an answer stream using the LLM provider with BAML ClientRegistry
 * @param req - The HTTPRequest object from BAML streamRequest.GenerateAnswer
 * @param model - The LLM model to use (optional, defaults to alibaba/qwen3)
 * @returns A promise that resolves with the answer stream
 */
export async function generateAnswerStream(
  req: HTTPRequest,
  model: SupportedLLM,
  useReasoning: boolean = true,
): Promise<any> {
  // Remove the unused client instantiation that was causing the OpenAI API key error
  return await get_provider(model).chat.completions.create({
    ...req.body.json(),
    thinking: {
      type: `${useReasoning}`,
    },
  });
}
