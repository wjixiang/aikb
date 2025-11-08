import { AgentNode, AgentState, AgentStep, ChatMessage } from './agent.types';
import rag_workflow from '@/kgrag/lib/llm_workflow/rag_workflow';
import { rag_config } from '@/kgrag/lib/llm_workflow/rag_workflow';
import { LlmStreamCall } from '@boundaryml/baml/native';

/**
 * 1. retrieve documents about query
 * 2. summarize correspondant docs
 * 4. judging whether to re-fetch document
 */
export class ExecuteRAGNode {
  taskName = 'Execute_RAG';

  constructor() {}

  async *execute(
    state: ChatMessage[],
    query: string,
    rag_config: rag_config,
  ): AsyncGenerator<AgentStep> {
    try {
      // Get HyDE setting from state (passed through ChatRuntime)
      const { stream, bamlDocuments, collector } = await rag_workflow(
        query,
        rag_config,
      );
      let preChunk = '';
      let llmResponse: string[] = [];
      let cotContent = '';

      for await (const chunk of stream) {
        if (chunk.choices.length > 0) {
          // Handle reasoning content (CoT)
          if (chunk.choices[0].delta.reasoning_content) {
            const reasoningChunk = chunk.choices[0].delta.reasoning_content;
            cotContent += reasoningChunk;

            yield {
              type: 'cot',
              content: reasoningChunk,
              task: this.taskName,
            };
          }

          // Handle main content
          if (chunk.choices[0].delta.content) {
            const contentChunk = chunk.choices[0].delta.content;
            llmResponse.push(contentChunk);

            yield {
              type: 'update',
              content: contentChunk,
              task: this.taskName,
            };

            // Yield speech data for main content
            yield {
              type: 'speech',
              content: '',
              task: this.taskName,
              speechData: {
                text: contentChunk,
                isComplete: false,
                language: rag_config.language || 'zh',
              },
            };
          }
        }
        preChunk = chunk;
      }

      // Final speech data with completion flag
      yield {
        type: 'speech',
        content: '',
        task: this.taskName,
        speechData: {
          text: '',
          isComplete: true,
          language: rag_config.language || 'zh',
        },
      };

      yield {
        type: 'result',
        content: 'RAG execution completed',
        task: this.taskName,
        data: { documents: bamlDocuments },
      };
    } catch (error) {
      console.error('Error in ExecuteRAGNode:', error);
      yield {
        type: 'error',
        content: error instanceof Error ? error.message : 'Unknown error',
        task: this.taskName,
      };
    }
  }
}
