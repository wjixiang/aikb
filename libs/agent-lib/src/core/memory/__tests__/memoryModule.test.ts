import { MemoryModule } from "../MemoryModule";
import { ApiClient, ApiResponse, ApiTimeoutConfig, ChatCompletionTool } from "../../api-client";
import { ThinkingRound } from "../Turn";
import { Logger } from "pino";
import { MessageBuilder } from "../types";
import { vi } from "vitest";

// Mock API Client for testing
class MockApiClient implements ApiClient {
    async makeRequest(
        systemPrompt: string,
        workspaceContext: string,
        memoryContext: string[],
        timeoutConfig?: ApiTimeoutConfig,
        tools?: ChatCompletionTool[]
    ): Promise<ApiResponse> {
        // Simulate API response
        return {
            toolCalls: [
                {
                    id: "call_123",
                    call_id: "call_123",
                    type: "function_call",
                    name: "continue_thinking",
                    arguments: JSON.stringify({
                        continueThinking: false,
                        thoughtNumber: 1,
                        totalThoughts: 1
                    })
                }
            ],
            textResponse: "This is a mock thinking response for testing purposes.",
            requestTime: 100,
            tokenUsage: {
                promptTokens: 50,
                completionTokens: 20,
                totalTokens: 70
            }
        };
    }
}

const mockClient = new MockApiClient();

// Mock Logger - using pino interface
const mockLogger: Logger = {
    level: 'info',
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    fatal: vi.fn(),
    child: vi.fn(() => mockLogger as any),
} as any;


describe('MemoryModule', () => {
    let memoryModule: MemoryModule;

    beforeEach(() => {
        // Create MemoryModule
        memoryModule = new MemoryModule(mockLogger, {}, mockClient);
    });

    describe('render workspace context with diff', () => {
        it('should git diff between two components', () => {
            const diff_result = memoryModule._computeContextDiff('context A', 'context B')
            console.log(diff_result)
        })
    })
});
