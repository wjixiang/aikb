import { describe, it, expect } from 'vitest';
import { MemoryModule } from '../MemoryModule';
import { ApiClient, ApiResponse } from '../../api-client';
import { TurnMemoryStore } from '../TurnMemoryStore';
import { Logger } from 'pino';
import { MessageBuilder } from '../../task/task.type';

class MockClient implements ApiClient {
    async makeRequest(): Promise<ApiResponse> {
        return {
            toolCalls: [],
            textResponse: "Mock",
            requestTime: 100,
            tokenUsage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 }
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

describe('Workspace Context Retrieval', () => {
    it('demonstrates difference between getAllMessages and getAllTurns', () => {
        const memoryModule = new MemoryModule(new MockClient(), mockLogger, {}, new TurnMemoryStore());

        // Create 2 turns with different contexts
        memoryModule.startTurn('Initial workspace: empty project');
        memoryModule.addMessage(MessageBuilder.user('Create a file'));
        memoryModule.addMessage(MessageBuilder.assistant('Created file.txt'));
        memoryModule.completeTurn();

        memoryModule.startTurn('Updated workspace: file.txt exists');
        memoryModule.addMessage(MessageBuilder.user('Add content to file'));
        memoryModule.addMessage(MessageBuilder.assistant('Added content'));
        memoryModule.completeTurn();

        console.log('\n=== Using getAllMessages() ===');
        const allMessages = memoryModule.getTurnStore().getAllMessages();
        console.log('Total messages:', allMessages.length);
        console.log('Can access workspace context?', 'NO ❌');
        console.log('Messages only contain:', allMessages[0]);
        console.log('\n');

        console.log('=== Using getAllTurns() ===');
        const allTurns = memoryModule.getTurnStore().getAllTurns();
        console.log('Total turns:', allTurns.length);
        console.log('Can access workspace context?', 'YES ✅');

        allTurns.forEach(turn => {
            console.log(`\nTurn ${turn.turnNumber}:`);
            console.log('  Messages:', turn.messages.length);
            console.log('  Workspace context:', turn.workspaceContext);
        });

        // Verify
        expect(allMessages.length).toBe(4); // 4 messages total
        expect(allTurns.length).toBe(2);    // 2 turns

        // Messages don't have workspace context
        expect(allMessages[0]).not.toHaveProperty('workspaceContext');

        // Turns have workspace context (immutable)
        expect(allTurns[0].workspaceContext).toBe('Initial workspace: empty project');
        expect(allTurns[1].workspaceContext).toBe('Updated workspace: file.txt exists');
    });

    it('shows how to get messages WITH context', () => {
        const memoryModule = new MemoryModule(new MockClient(), mockLogger, {}, new TurnMemoryStore());

        // Create a turn
        memoryModule.startTurn('Context: empty directory');
        memoryModule.addMessage(MessageBuilder.user('List files'));
        memoryModule.addMessage(MessageBuilder.assistant('No files found'));
        memoryModule.completeTurn();

        // Wrong way: only messages, no context
        const messagesOnly = memoryModule.getTurnStore().getAllMessages();
        console.log('\n❌ Wrong way (messages only):');
        console.log('  Messages:', messagesOnly.length);
        console.log('  Has context?', 'workspaceContext' in messagesOnly[0] ? 'Yes' : 'No');

        // Right way: get turns with full context
        const turns = memoryModule.getTurnStore().getAllTurns();
        console.log('\n✅ Right way (turns with context):');
        turns.forEach(turn => {
            console.log(`  Turn ${turn.turnNumber}:`);
            console.log('    Messages:', turn.messages.length);
            console.log('    Workspace context:', turn.workspaceContext);
        });

        // Or create a combined structure
        const messagesWithContext = turns.flatMap(turn =>
            turn.messages.map(msg => ({
                ...msg,
                turnNumber: turn.turnNumber,
                workspaceContext: turn.workspaceContext,
            }))
        );

        console.log('\n✅ Best way (messages enriched with context):');
        messagesWithContext.forEach((msg, i) => {
            console.log(`  Message ${i + 1}:`);
            console.log('    Role:', msg.role);
            console.log('    Turn:', msg.turnNumber);
            console.log('    Workspace context:', msg.workspaceContext);
        });

        expect(messagesWithContext[0]).toHaveProperty('workspaceContext');
        expect(messagesWithContext[0].workspaceContext).toBe('Context: empty directory');
    });
});
