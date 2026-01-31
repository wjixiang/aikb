import { AgentMessage, ChatMessage } from './agent.types';
import { ToolRegistry, toolRegistry } from './toolRegistry';
import { b } from '../../baml_client';
import type {
  Message as BamlMessage,
  ToolDefinition,
  ToolResult,
  AgentDecision,
  StepResponse,
} from '@/types/baml';

type agent_action = 'send_notification' | 'stream_message';

export default class Agent {
  context: ChatMessage[] = [];
  isTaskComplete: boolean = false;
  toolRegistry: ToolRegistry;
  maxSteps: number = 10;
  currentStep: number = 0;

  constructor() {
    this.toolRegistry = toolRegistry;
  }

  /**
   * Convert internal ChatMessage to BAML Message format
   */
  private convertToBamlMessage(chatMessage: ChatMessage): BamlMessage {
    return {
      role: chatMessage.sender,
      content: chatMessage.content,
      timestamp: chatMessage.timestamp.toISOString(),
      tool_calls: undefined,
      tool_results: undefined,
    };
  }

  /**
   * Convert BAML Message to internal ChatMessage format
   */
  private convertFromBamlMessage(bamlMessage: BamlMessage): ChatMessage {
    return {
      sender: bamlMessage.role as 'user' | 'ai' | 'system',
      content: bamlMessage.content,
      timestamp: new Date(bamlMessage.timestamp),
      isVisible: true,
      messageType: 'content',
    };
  }

  /**
   * Get available tools in BAML format
   */
  private getAvailableTools(): ToolDefinition[] {
    return this.toolRegistry.listTools();
  }

  /**
   * Decide next action using BAML LLM
   * @param userQuery The user's query
   * @param conversationHistory The conversation history
   * @param availableTools Available tools
   * @param currentContext Current context
   * @returns Agent decision
   */
  private async decideNextAction(
    userQuery: string,
    conversationHistory: BamlMessage[],
    availableTools: ToolDefinition[],
    currentContext: string,
  ): Promise<AgentDecision> {
    return await b.AgentDecideNextAction(
      userQuery,
      conversationHistory,
      availableTools,
      currentContext,
    );
  }

  /**
   * Execute a tool call using BAML
   * @param toolName Tool name
   * @param parameters Tool parameters
   * @param toolDefinitions Tool definitions
   * @returns Tool result
   */
  private async executeToolCall(
    toolName: string,
    parameters: Record<string, any>,
    toolDefinitions: ToolDefinition[],
  ): Promise<ToolResult> {
    // Convert parameters to the format expected by BAML
    const bamlParameters: Record<string, any> = {};
    for (const [key, value] of Object.entries(parameters)) {
      bamlParameters[key] = {
        name: key,
        type: typeof value,
        description: '',
        required: true,
      };
    }

    return await b.ExecuteToolCall(toolName, bamlParameters, toolDefinitions);
  }

  /**
   * Generate agent response using BAML
   * @param userQuery The user's query
   * @param toolResults Results from tool executions
   * @param conversationHistory The conversation history
   * @returns Step response
   */
  private async generateAgentResponse(
    userQuery: string,
    toolResults: ToolResult[],
    conversationHistory: BamlMessage[],
  ): Promise<StepResponse> {
    return await b.GenerateAgentResponse(
      userQuery,
      toolResults,
      conversationHistory,
    );
  }

  /**
   * Finalize agent response using BAML
   * @param conversationHistory The conversation history
   * @param accumulatedInformation Accumulated information from tool calls
   * @returns Final step response
   */
  private async finalizeAgentResponse(
    conversationHistory: BamlMessage[],
    accumulatedInformation: string,
  ): Promise<StepResponse> {
    return await b.FinalizeAgentResponse(
      conversationHistory,
      accumulatedInformation,
    );
  }

  async *start(query: string): AsyncGenerator<AgentMessage> {
    // Initialize conversation
    const conversationHistory: BamlMessage[] = [
      ...this.context.map((msg) => this.convertToBamlMessage(msg)),
      {
        role: 'user',
        content: query,
        timestamp: new Date().toISOString(),
      },
    ];

    let accumulatedInformation = '';
    this.currentStep = 0;

    // Tool calling loop
    while (this.currentStep < this.maxSteps) {
      this.currentStep++;

      try {
        // Step 1: Decide next action
        yield {
          type: 'step',
          content: `Step ${this.currentStep}: Deciding next action...`,
          task: 'agent_decision',
        };

        const availableTools = this.getAvailableTools();
        const currentContext = accumulatedInformation;

        const decision: AgentDecision = await this.decideNextAction(
          query,
          conversationHistory,
          availableTools,
          currentContext,
        );

        // If no tool should be used, break the loop
        if (!decision.should_use_tool || !decision.selected_tool) {
          break;
        }

        yield {
          type: 'notice',
          content: `Decision: ${decision.reasoning}`,
          task: 'agent_decision',
        };

        // Step 2: Execute selected tool
        yield {
          type: 'step',
          content: `Executing tool: ${decision.selected_tool}`,
          task: 'tool_execution',
        };

        // For now, we'll use empty parameters - in a real implementation,
        // we would extract parameters from the decision
        const toolParameters: Record<string, any> = {};

        try {
          const toolResult: ToolResult = await this.toolRegistry.executeTool(
            decision.selected_tool,
            toolParameters,
          );

          // Add tool result to conversation history
          conversationHistory.push({
            role: 'tool',
            content: JSON.stringify(toolResult),
            timestamp: new Date().toISOString(),
            tool_results: [toolResult],
          });

          accumulatedInformation += `\nTool ${decision.selected_tool} result: ${toolResult.result}`;

          yield {
            type: 'update',
            content: `Tool ${decision.selected_tool} executed ${toolResult.success ? 'successfully' : 'with error'}`,
            task: 'tool_execution',
          };

          if (!toolResult.success && toolResult.error_message) {
            yield {
              type: 'error',
              content: `Tool error: ${toolResult.error_message}`,
              task: 'tool_execution',
            };
          }
        } catch (error) {
          yield {
            type: 'error',
            content: `Error executing tool ${decision.selected_tool}: ${error instanceof Error ? error.message : 'Unknown error'}`,
            task: 'tool_execution',
          };
          break;
        }
      } catch (error) {
        yield {
          type: 'error',
          content: `Error in agent decision step: ${error instanceof Error ? error.message : 'Unknown error'}`,
          task: 'agent_decision',
        };
        break;
      }
    }

    // Finalize response
    try {
      yield {
        type: 'step',
        content: 'Generating final response...',
        task: 'final_response',
      };

      const finalResponse: StepResponse = await this.finalizeAgentResponse(
        conversationHistory,
        accumulatedInformation,
      );

      yield {
        type: 'result',
        content: finalResponse.response,
        task: 'final_response',
      };
    } catch (error) {
      yield {
        type: 'error',
        content: `Error generating final response: ${error instanceof Error ? error.message : 'Unknown error'}`,
        task: 'final_response',
      };
    }
  }
}
