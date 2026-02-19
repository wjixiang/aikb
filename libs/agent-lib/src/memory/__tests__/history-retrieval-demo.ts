import { MemoryModule } from '../MemoryModule';
import { ApiClient, ApiResponse } from '../../api-client';

// Mock client
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

async function demonstrateHistoryRetrieval() {
    const memoryModule = new MemoryModule(new MockClient());

    // 模拟 3 个 Turn
    console.log('=== Creating 3 turns ===\n');

    // Turn 1
    memoryModule.startTurn('workspace context 1');
    memoryModule.addUserMessage('What is 2+2?');
    memoryModule.addAssistantMessage([{ type: 'text', text: '2+2 equals 4' }]);
    memoryModule.recordToolCall('calculator', true, '4');
    memoryModule.completeTurn();

    // Turn 2
    memoryModule.startTurn('workspace context 2');
    memoryModule.addUserMessage('What is the capital of France?');
    memoryModule.addAssistantMessage([{ type: 'text', text: 'The capital of France is Paris' }]);
    memoryModule.recordToolCall('search', true, 'Paris');
    memoryModule.completeTurn();

    // Turn 3
    memoryModule.startTurn('workspace context 3');
    memoryModule.addUserMessage('Tell me a joke');
    memoryModule.addAssistantMessage([{ type: 'text', text: 'Why did the chicken cross the road?' }]);
    memoryModule.completeTurn();

    console.log('=== Method 1: Get all messages (flattened) ===');
    const allMessages = memoryModule.getAllMessages();
    console.log(`Total messages: ${allMessages.length}`);
    allMessages.forEach((msg, i) => {
        const content = msg.content
            .filter(c => c.type === 'text')
            .map(c => (c as any).text)
            .join(' ');
        console.log(`  ${i + 1}. [${msg.role}] ${content.substring(0, 50)}...`);
    });
    console.log();

    console.log('=== Method 2: Get specific turn ===');
    const turn2 = memoryModule.getTurnStore().getTurnByNumber(2);
    if (turn2) {
        console.log(`Turn ${turn2.turnNumber}:`);
        console.log(`  Status: ${turn2.status}`);
        console.log(`  Messages: ${turn2.messages.length}`);
        console.log(`  Tool calls: ${turn2.toolCalls.length}`);
    }
    console.log();

    console.log('=== Method 3: Get recent messages (last 2 turns) ===');
    const recentMessages = memoryModule.getTurnStore().getRecentMessages(2);
    console.log(`Recent messages from last 2 turns: ${recentMessages.length}`);
    recentMessages.forEach((msg, i) => {
        const content = msg.content
            .filter(c => c.type === 'text')
            .map(c => (c as any).text)
            .join(' ');
        console.log(`  ${i + 1}. [${msg.role}] ${content.substring(0, 50)}...`);
    });
    console.log();

    console.log('=== Method 4: Get all turns (complete info) ===');
    const allTurns = memoryModule.getTurnStore().getAllTurns();
    console.log(`Total turns: ${allTurns.length}`);
    allTurns.forEach(turn => {
        console.log(`\nTurn ${turn.turnNumber}:`);
        console.log(`  Messages: ${turn.messages.length}`);
        console.log(`  Tool calls: ${turn.toolCalls.map(tc => tc.toolName).join(', ') || 'none'}`);
        console.log(`  Status: ${turn.status}`);
    });
    console.log();

    console.log('=== Method 5: Recall specific turns (1 and 3) ===');
    const recalled = memoryModule.recallTurns([1, 3]);
    console.log(`Recalled messages: ${recalled.length}`);
    recalled.forEach((msg, i) => {
        const content = msg.content
            .filter(c => c.type === 'text')
            .map(c => (c as any).text)
            .join(' ');
        console.log(`  ${i + 1}. [${msg.role}] ${content.substring(0, 50)}...`);
    });
    console.log();

    console.log('=== Method 6: Get history for prompt (after recall) ===');
    const historyForPrompt = memoryModule.getHistoryForPrompt();
    console.log(`Messages for prompt: ${historyForPrompt.length}`);
    console.log('(These are the recalled messages from turns 1 and 3)');
    console.log();

    console.log('=== Method 7: Export all memory ===');
    const exported = memoryModule.export();
    console.log(`Exported data:`);
    console.log(`  Total turns: ${exported.turns.length}`);
    console.log(`  Current turn number: ${exported.currentTurnNumber}`);
    console.log(`  Total messages across all turns: ${exported.turns.reduce((sum, t) => sum + t.messages.length, 0)}`);
}

// Run the demonstration
demonstrateHistoryRetrieval().catch(console.error);
