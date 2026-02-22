import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryModule } from '../MemoryModule';
import { TurnStatus } from '../Turn';
import { ApiClient, ApiResponse, ApiTimeoutConfig, ChatCompletionTool } from '../../api-client';
import { TurnMemoryStore } from '../TurnMemoryStore';
import { Logger } from 'pino';

// Mock API Client for testing
class MockApiClient implements ApiClient {
    async makeRequest(
        systemPrompt: string,
        workspaceContext: string,
        memoryContext: string[],
        timeoutConfig?: ApiTimeoutConfig,
        tools?: ChatCompletionTool[]
    ): Promise<ApiResponse> {
        return {
            toolCalls: [],
            textResponse: "Mock response",
            requestTime: 100,
            tokenUsage: {
                promptTokens: 50,
                completionTokens: 20,
                totalTokens: 70
            }
        };
    }
}

// Mock Logger
const mockLogger: Logger = {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    fatal: vi.fn(),
    silent: vi.fn(),
    child: vi.fn(() => mockLogger as any),
} as any;

describe('Turn-based Memory Integration', () => {
    let memoryModule: MemoryModule;
    let mockClient: MockApiClient;
    let mockTurnStore: TurnMemoryStore;

    beforeEach(() => {
        mockClient = new MockApiClient();
        mockTurnStore = new TurnMemoryStore();
        memoryModule = new MemoryModule(mockClient, mockLogger, {}, mockTurnStore);
    });

    it('should manage complete turn lifecycle', async () => {
        // Start turn
        const turn = memoryModule.startTurn('initial workspace context');
        expect(turn.status).toBe(TurnStatus.PENDING);
        expect(turn.turnNumber).toBe(1);
        expect(turn.workspaceContext).toBe('initial workspace context');

        // Add messages
        memoryModule.addUserMessage('Hello');
        memoryModule.addAssistantMessage([{ type: 'text', text: 'Hi there' }]);

        // Perform thinking phase
        const thinkingResult = await memoryModule.performThinkingPhase(
            'workspace after thinking',
            []
        );
        expect(thinkingResult.turnId).toBe(turn.id);

        // Record tool calls
        memoryModule.recordToolCall('test_tool', true, 'success');

        // Complete turn (no parameters needed)
        memoryModule.completeTurn();

        // Verify turn state
        const completedTurn = memoryModule.getTurnStore().getTurn(turn.id);
        expect(completedTurn?.status).toBe(TurnStatus.COMPLETED);
        expect(completedTurn?.messages).toHaveLength(2);
        expect(completedTurn?.workspaceContext).toBe('initial workspace context');
        expect(completedTurn?.toolCalls).toHaveLength(1);
    });

    it('should handle multiple turns', async () => {
        // Turn 1
        memoryModule.startTurn('context 1');
        memoryModule.addUserMessage('First message');
        memoryModule.completeTurn();

        // Turn 2
        memoryModule.startTurn('context 2');
        memoryModule.addUserMessage('Second message');
        memoryModule.completeTurn();

        // Turn 3
        memoryModule.startTurn('context 3');
        memoryModule.addUserMessage('Third message');
        memoryModule.completeTurn();

        // Verify all turns
        const allTurns = memoryModule.getTurnStore().getAllTurns();
        expect(allTurns).toHaveLength(3);
        expect(allTurns[0].turnNumber).toBe(1);
        expect(allTurns[1].turnNumber).toBe(2);
        expect(allTurns[2].turnNumber).toBe(3);

        // Verify workspace contexts are immutable
        expect(allTurns[0].workspaceContext).toBe('context 1');
        expect(allTurns[1].workspaceContext).toBe('context 2');
        expect(allTurns[2].workspaceContext).toBe('context 3');

        // Verify all messages
        const allMessages = memoryModule.getAllMessages();
        expect(allMessages).toHaveLength(3);
    });

    it('should recall messages from specific turns', () => {
        // Create 3 turns with messages
        memoryModule.startTurn('context 1');
        memoryModule.addUserMessage('Message in turn 1');
        memoryModule.completeTurn();

        memoryModule.startTurn('context 2');
        memoryModule.addUserMessage('Message in turn 2');
        memoryModule.completeTurn();

        memoryModule.startTurn('context 3');
        memoryModule.addUserMessage('Message in turn 3');
        memoryModule.completeTurn();

        // Recall turn 1 and 3
        const recalled = memoryModule.recallTurns([1, 3]);
        expect(recalled).toHaveLength(2);

        // Verify recalled messages are from correct turns
        const turn1 = memoryModule.getTurnStore().getTurnByNumber(1);
        const turn3 = memoryModule.getTurnStore().getTurnByNumber(3);
        expect(recalled[0]).toEqual(turn1?.messages[0]);
        expect(recalled[1]).toEqual(turn3?.messages[0]);
    });

    it('should auto-complete previous turn when starting new turn', () => {
        // Start turn 1 but don't complete it
        const turn1 = memoryModule.startTurn('context 1');
        memoryModule.addUserMessage('Message 1');

        // Start turn 2 (should auto-complete turn 1)
        const turn2 = memoryModule.startTurn('context 2');

        // Verify turn 1 was completed
        const completedTurn1 = memoryModule.getTurnStore().getTurn(turn1.id);
        expect(completedTurn1?.status).toBe(TurnStatus.COMPLETED);

        // Verify turn 2 is current
        expect(memoryModule.getCurrentTurn()?.id).toBe(turn2.id);
    });

    it('should export and import turn-based memory', () => {
        // Create some turns
        memoryModule.startTurn('context 1');
        memoryModule.addUserMessage('Message 1');
        memoryModule.recordToolCall('tool1', true, 'result1');
        memoryModule.completeTurn();

        memoryModule.startTurn('context 2');
        memoryModule.addUserMessage('Message 2');
        memoryModule.completeTurn();

        // Export
        const exported = memoryModule.export();
        expect(exported.turns).toHaveLength(2);
        expect(exported.currentTurnNumber).toBe(2);

        // Import to new module
        const newModule = new MemoryModule(mockClient, mockLogger, {}, new TurnMemoryStore());
        newModule.import(exported);

        // Verify imported data
        const importedTurns = newModule.getTurnStore().getAllTurns();
        expect(importedTurns).toHaveLength(2);
        expect(importedTurns[0].messages).toHaveLength(1);
        expect(importedTurns[0].toolCalls).toHaveLength(1);
        expect(importedTurns[0].workspaceContext).toBe('context 1');
        expect(importedTurns[1].workspaceContext).toBe('context 2');
    });
});
