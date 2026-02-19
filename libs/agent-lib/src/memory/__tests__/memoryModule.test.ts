import { MemoryModule } from "../MemoryModule";
import { ApiClient, ApiResponse, ApiTimeoutConfig, ChatCompletionTool } from "../../api-client";

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
                        reason: "Mock test - ready to proceed"
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

describe('MemoryModule', () => {
    let memoryModule: MemoryModule;

    beforeEach(() => {
        memoryModule = new MemoryModule(mockClient);
    });

    it.only('should perform thinking phase single time', async () => {
        // Start a turn first
        memoryModule.startTurn('test_workspace');

        const spy = vi.spyOn(mockClient, 'makeRequest')
        const result = await memoryModule.performSingleThinkingRound(1, 'test_workspace', []);
        console.log(result)
        console.log(spy.mock.calls)

        expect(result).toBeDefined();
        expect(result.roundNumber).toBe(1);
        expect(result.content).toBe("This is a mock thinking response for testing purposes.");
        expect(result.continueThinking).toBe(false);
        expect(result.tokens).toBeGreaterThan(0);

        memoryModule.completeTurn()
        console.log(memoryModule.getTurnStore().getAllTurns())
    });

    // it('should render proper prompt for thinking phase', async () => {

    // })

    it('should add messages to conversation history', () => {
        // Start a turn first
        memoryModule.startTurn('test_workspace');

        memoryModule.addUserMessage('Hello');
        memoryModule.addAssistantMessage([{ type: 'text', text: 'Hi there' }]);

        const history = memoryModule.getAllMessages();
        console.log(history)
        expect(history).toHaveLength(2);
        expect(history[0].role).toBe('user');
        expect(history[1].role).toBe('assistant');
    });

    it('should clear conversation history', () => {
        // Start a turn first
        memoryModule.startTurn('test_workspace');

        memoryModule.addUserMessage('Test message');
        expect(memoryModule.getAllMessages()).toHaveLength(1);

        memoryModule.clear();
        expect(memoryModule.getAllMessages()).toHaveLength(0);
    });
});