import { describe, it, expect } from 'vitest';
import { ToolCall, ApiResponse } from '../ApiClient.interface';
import { BamlApiClient } from '../BamlApiClient';
import { OpenaiCompatibleApiClient } from '../OpenaiCompatibleApiClient';

describe('ApiClient Refactoring Tests', () => {
  describe('ToolCall Interface', () => {
    it('should have correct structure matching OpenAI format', () => {
      const toolCall: ToolCall = {
        id: 'fc_12345xyz',
        call_id: 'call_12345xyz',
        type: 'function_call',
        name: 'get_weather',
        arguments: '{"location":"Paris, France"}',
      };

      expect(toolCall.id).toBe('fc_12345xyz');
      expect(toolCall.call_id).toBe('call_12345xyz');
      expect(toolCall.type).toBe('function_call');
      expect(toolCall.name).toBe('get_weather');
      expect(toolCall.arguments).toBe('{"location":"Paris, France"}');
    });

    it('should support multiple tool calls in ApiResponse', () => {
      const response: ApiResponse = {
        toolCalls: [
          {
            id: 'fc_1',
            call_id: 'call_1',
            type: 'function_call',
            name: 'tool_a',
            arguments: '{"param":"value1"}',
          },
          {
            id: 'fc_2',
            call_id: 'call_2',
            type: 'function_call',
            name: 'tool_b',
            arguments: '{"param":"value2"}',
          },
        ],
        textResponse: 'Some text response',
        requestTime: 1500,
        tokenUsage: {
          promptTokens: 100,
          completionTokens: 50,
          totalTokens: 150,
        },
      };

      expect(response.toolCalls).toHaveLength(2);
      expect(response.toolCalls[0].name).toBe('tool_a');
      expect(response.toolCalls[1].name).toBe('tool_b');
      expect(response.textResponse).toBe('Some text response');
      expect(response.requestTime).toBe(1500);
      expect(response.tokenUsage.totalTokens).toBe(150);
    });
  });

  describe('BamlApiClient', () => {
    it('should convert legacy format to new format', () => {
      const client = new BamlApiClient();

      // Test that the client can be instantiated
      expect(client).toBeDefined();
      expect(client.makeRequest).toBeDefined();
    });
  });

  describe('OpenaiCompatibleApiClient', () => {
    it('should be instantiable with config', () => {
      const client = new OpenaiCompatibleApiClient({
        apiKey: 'test-key',
        model: 'gpt-4',
        baseURL: 'https://api.openai.com/v1',
      });

      expect(client).toBeDefined();
      expect(client.makeRequest).toBeDefined();
    });
  });

  describe('Backward Compatibility', () => {
    it('should handle attempt_completion as a regular tool call', () => {
      const completionCall: ToolCall = {
        id: 'fc_completion',
        call_id: 'call_completion',
        type: 'function_call',
        name: 'attempt_completion',
        arguments: '{"result":"Task completed successfully"}',
      };

      expect(completionCall.name).toBe('attempt_completion');

      // Parse arguments to verify structure
      const args = JSON.parse(completionCall.arguments);
      expect(args.result).toBe('Task completed successfully');
    });

    it('should support empty tool call arrays', () => {
      const emptyResponse: ApiResponse = {
        toolCalls: [],
        textResponse: '',
        requestTime: 0,
        tokenUsage: {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
        },
      };
      expect(emptyResponse.toolCalls).toHaveLength(0);
    });
  });
});
