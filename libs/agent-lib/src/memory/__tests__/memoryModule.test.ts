import { MemoryModule } from "../MemoryModule";
import { ThinkingModule } from "../../thinking/ThinkingModule";
import { ApiClient, ApiResponse, ApiTimeoutConfig, ChatCompletionTool } from "../../api-client";
import { ThinkingRound } from "../Turn";
import { Logger } from "pino";
import { TurnMemoryStore } from "../TurnMemoryStore";
import { MessageBuilder } from "../../task/task.type";
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

// Mock TurnMemoryStore
const mockTurnStore = new TurnMemoryStore();

describe('MemoryModule', () => {
    let memoryModule: MemoryModule;
    let thinkingModule: ThinkingModule;

    beforeEach(() => {
        // Create ThinkingModule first
        thinkingModule = new ThinkingModule(mockClient, mockLogger, {}, mockTurnStore);
        // Create MemoryModule with ThinkingModule dependency
        memoryModule = new MemoryModule(mockLogger, {}, mockTurnStore, thinkingModule);
    });

    it('should perform thinking phase single time', async () => {
        // Start a turn first
        memoryModule.startTurn('test_workspace');

        const spy = vi.spyOn(mockClient, 'makeRequest')
        const result = await memoryModule.performThinkingPhase('test_workspace', []);
        console.log(result)
        console.log(spy.mock.calls)

        expect(result).toBeDefined();
        expect(result.rounds).toBeDefined();
        expect(result.rounds.length).toBeGreaterThan(0);
        expect(result.tokensUsed).toBeGreaterThan(0);

        memoryModule.completeTurn()
        console.log(memoryModule.getTurnStore().getAllTurns())
    });

    it('check if history thinking step has been rendered into prompt', async () => {
        memoryModule.startTurn('test_workspace')
        const spy = vi.spyOn(mockClient, 'makeRequest')
        const testRounds: ThinkingRound[] = [
            {
                roundNumber: 1,
                content: "First thinking round: Analyzing the user's request to understand the task requirements.",
                continueThinking: true,
                recalledContexts: [],
                tokens: 50,
                thoughtNumber: 1,
                totalThoughts: 3
            },
            {
                roundNumber: 2,
                content: "Second thinking round: Identified key components needed for the solution. Considering available tools and their capabilities.",
                continueThinking: true,
                recalledContexts: [
                    { turnNumber: 1, relevanceScore: 0.8, content: "Previous similar task context" }
                ],
                tokens: 65,
                thoughtNumber: 2,
                totalThoughts: 3
            },
            {
                roundNumber: 3,
                content: "Third thinking round: Formulating action plan. Ready to proceed with tool execution.",
                continueThinking: true,
                recalledContexts: [
                    { turnNumber: 1, relevanceScore: 0.7, content: "Historical context from turn 1" },
                    { turnNumber: 2, relevanceScore: 0.9, content: "Recent context from turn 2" }
                ],
                tokens: 55,
                summary: "Completed analysis and formulated action plan for the requested task.",
                thoughtNumber: 3,
                totalThoughts: 3
            }
        ]
        // Use performThinkingPhase instead of performSingleThinkingRound
        const result = await memoryModule.performThinkingPhase('test_workspace', []);
        console.log(spy.mock.calls[0])
    })

    // it('should render proper prompt for thinking phase', async () => {

    // })

    it('should add messages to conversation history', () => {
        // Start a turn first
        memoryModule.startTurn('test_workspace');

        memoryModule.addMessage(MessageBuilder.user('Hello'));
        memoryModule.addMessage(MessageBuilder.assistant('Hi there'));

        const history = memoryModule.getAllMessages();
        console.log(history)
        expect(history).toHaveLength(2);
        expect(history[0].role).toBe('user');
        expect(history[1].role).toBe('assistant');
    });

    it('should clear conversation history', () => {
        // Start a turn first
        memoryModule.startTurn('test_workspace');

        memoryModule.addMessage(MessageBuilder.user('Test message'));
        expect(memoryModule.getAllMessages()).toHaveLength(1);

        memoryModule.clear();
        expect(memoryModule.getAllMessages()).toHaveLength(0);
    });

    it('should render tools in thinking prompt', async () => {
        // Start a turn
        memoryModule.startTurn('test_workspace', 'test_task');

        // Spy on makeRequest to capture the prompt
        const spy = vi.spyOn(mockClient, 'makeRequest');

        // Perform a thinking phase
        await memoryModule.performThinkingPhase('test_workspace', []);

        // Verify makeRequest was called
        expect(spy).toHaveBeenCalled();
        const calls = spy.mock.calls;
        expect(calls.length).toBeGreaterThan(0);

        // Get the system prompt (first argument)
        const systemPrompt = calls[0][0] as string;

        // Verify tools are rendered in the system prompt
        expect(systemPrompt).toContain('Tool Name:');
        expect(systemPrompt).toContain('continue_thinking');
        expect(systemPrompt).toContain('recall_context');
        expect(systemPrompt).toContain('Parameters:');
        expect(systemPrompt).toContain('continueThinking');
        expect(systemPrompt).toContain('turnNumbers');
    });

    describe('message storage', () => {
        it.only('should store assistant messages', async () => {
            memoryModule.startTurn('turn1')
            memoryModule.addMessage(MessageBuilder.assistant('test assistant message'))

            const result = memoryModule.getAllMessages()
            console.log(JSON.stringify(result, null, 2))
        })
    })
});
