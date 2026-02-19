/**
 * Integration example: Agent with Memory Module
 */

import { Agent, AgentConfig } from '../agent/agent.js';
import { VirtualWorkspace } from '../statefulContext/virtualWorkspace.js';
import { ApiClient } from '../api-client/index.js';

/**
 * Example 1: Basic usage with memory enabled
 */
async function example1_BasicMemory() {
    console.log('=== Example 1: Basic Memory ===\n');

    // Configure agent with memory
    const config: AgentConfig = {
        apiRequestTimeout: 40000,
        maxRetryAttempts: 3,
        consecutiveMistakeLimit: 3,

        // Enable memory module
        memory: {
            maxThinkingRounds: 3,
            thinkingTokenBudget: 10000,
            enableRecall: true,
            maxRecallContexts: 3,
            enableSummarization: true,
        },
    };

    const workspace = new VirtualWorkspace({
        name: 'example-workspace',
        description: 'Example workspace',
    });

    const apiClient: ApiClient = {
        makeRequest: async () => {
            // Mock implementation
            return {} as any;
        },
    };

    const agent = new Agent(
        config,
        workspace,
        {
            capability: 'You are a helpful AI assistant.',
            direction: 'Think deeply before acting.',
        },
        apiClient
    );

    // Check if memory is enabled
    if (agent.hasMemoryModule()) {
        console.log('✓ Memory module is enabled');
    }

    // Start agent
    await agent.start('Analyze the codebase');

    // Access memory
    const memoryModule = agent.getMemoryModule();
    if (memoryModule) {
        const turnStore = memoryModule.getTurnStore();
        console.log(`Total turns: ${turnStore.getCurrentTurnNumber()}`);
        console.log(`Total summaries: ${turnStore.getAllSummaries().length}`);
    }
}

/**
 * Example 2: Memory operations
 */
async function example2_MemoryOperations() {
    console.log('\n=== Example 2: Memory Operations ===\n');

    const config: AgentConfig = {
        apiRequestTimeout: 40000,
        maxRetryAttempts: 3,
        consecutiveMistakeLimit: 3,
        memory: {
            maxThinkingRounds: 5,
            thinkingTokenBudget: 15000,
            enableRecall: true,
            maxRecallContexts: 3,
            enableSummarization: true,
        },
    };

    const workspace = new VirtualWorkspace({
        name: 'example-workspace',
        description: 'Example workspace',
    });

    const apiClient: ApiClient = {
        makeRequest: async () => ({ } as any),
    };

    const agent = new Agent(config, workspace, {
        capability: 'You are a helpful AI assistant.',
        direction: 'Think deeply before acting.',
    }, apiClient);

    const memoryModule = agent.getMemoryModule();
    if (!memoryModule) {
        console.error('Memory module not available');
        return;
    }

    const turnStore = memoryModule.getTurnStore();

    // Simulate multiple turns
    console.log('Simulating multiple turns...\n');

    // Turn 1
    memoryModule.startTurn('Context 1: Initial analysis');
    memoryModule.addUserMessage('Analyze the codebase');
    memoryModule.addAssistantMessage([{ type: 'text', text: 'Analyzed structure' }]);
    memoryModule.completeTurn();
    const turn1 = turnStore.getTurnByNumber(1);
    if (turn1) {
        turnStore.storeSummary(turn1.id, 'Analyzed codebase structure', ['3 modules', 'Main entry']);
        console.log(`Turn 1: Stored turn ${turn1.id}`);
    }

    // Turn 2
    memoryModule.startTurn('Context 2: Deep dive');
    memoryModule.addUserMessage('Find bottlenecks');
    memoryModule.addAssistantMessage([{ type: 'text', text: 'Found bottleneck' }]);
    memoryModule.completeTurn();
    const turn2 = turnStore.getTurnByNumber(2);
    if (turn2) {
        turnStore.storeSummary(turn2.id, 'Found performance bottleneck', ['Bottleneck in utils', 'O(n²)']);
        console.log(`Turn 2: Stored turn ${turn2.id}`);
    }

    // Turn 3
    memoryModule.startTurn('Context 3: Optimization');
    memoryModule.addUserMessage('Optimize code');
    memoryModule.addAssistantMessage([{ type: 'text', text: 'Optimized' }]);
    memoryModule.completeTurn();
    const turn3 = turnStore.getTurnByNumber(3);
    if (turn3) {
        turnStore.storeSummary(turn3.id, 'Implemented optimization', ['10x speedup', 'Tests passing']);
        console.log(`Turn 3: Stored turn ${turn3.id}`);
    }

    // Get recent summaries
    console.log('\nRecent summaries:');
    const recentSummaries = turnStore.getAllSummaries().slice(-3);
    recentSummaries.forEach(s => {
        console.log(`  [Turn ${s.turnNumber}] ${s.summary}`);
        console.log(`    Insights: ${s.insights.join('; ')}`);
    });

    // Search by keyword
    console.log('\nSearch for "optimization":');
    const searchResults = turnStore.searchSummaries('optimization');
    searchResults.forEach(s => {
        console.log(`  [Turn ${s.turnNumber}] ${s.summary}`);
    });

    // Get accumulated summaries
    console.log('\nAccumulated summaries:');
    const accumulated = memoryModule.getAccumulatedSummaries();
    console.log(accumulated);

    // Export memory
    console.log('\nExporting memory...');
    const exported = memoryModule.export();
    console.log(`Exported ${exported.turns.length} turns and ${exported.summaries.length} summaries`);
}

/**
 * Example 3: Dynamic configuration
 */
async function example3_DynamicConfig() {
    console.log('\n=== Example 3: Dynamic Configuration ===\n');

    const config: AgentConfig = {
        apiRequestTimeout: 40000,
        maxRetryAttempts: 3,
        consecutiveMistakeLimit: 3,
        memory: {
            enableReflectiveThinking: true,
            maxThinkingRounds: 3,
            thinkingTokenBudget: 10000,
            enableRecall: true,
            maxRecallContexts: 3,
            enableSummarization: true,
        },
    };

    const workspace = new VirtualWorkspace({
        name: 'example-workspace',
        description: 'Example workspace',
    });

    const apiClient: ApiClient = {
        makeRequest: async () => ({ } as any),
    };

    const agent = new Agent(config, workspace, {
        capability: 'You are a helpful AI assistant.',
        direction: 'Think deeply before acting.',
    }, apiClient);

    const memoryModule = agent.getMemoryModule();
    if (!memoryModule) {
        console.error('Memory module not available');
        return;
    }

    // Get current config
    console.log('Initial config:');
    const initialConfig = memoryModule.getConfig();
    console.log(`  Max thinking rounds: ${initialConfig.maxThinkingRounds}`);
    console.log(`  Thinking token budget: ${initialConfig.thinkingTokenBudget}`);

    // Update config for complex task
    console.log('\nUpdating config for complex task...');
    memoryModule.updateConfig({
        maxThinkingRounds: 7,
        thinkingTokenBudget: 20000,
    });

    const updatedConfig = memoryModule.getConfig();
    console.log(`  Max thinking rounds: ${updatedConfig.maxThinkingRounds}`);
    console.log(`  Thinking token budget: ${updatedConfig.thinkingTokenBudget}`);

    // Update config for simple task
    console.log('\nUpdating config for simple task...');
    memoryModule.updateConfig({
        maxThinkingRounds: 2,
        thinkingTokenBudget: 5000,
    });

    const simpleConfig = memoryModule.getConfig();
    console.log(`  Max thinking rounds: ${simpleConfig.maxThinkingRounds}`);
    console.log(`  Thinking token budget: ${simpleConfig.thinkingTokenBudget}`);
}

/**
 * Example 4: Quick thinking mode (minimal rounds)
 */
async function example4_QuickThinking() {
    console.log('\n=== Example 4: Quick Thinking Mode ===\n');

    const config: AgentConfig = {
        apiRequestTimeout: 40000,
        maxRetryAttempts: 3,
        consecutiveMistakeLimit: 3,
        memory: {
            maxThinkingRounds: 1,         // Minimal thinking - LLM can still decide to stop
            thinkingTokenBudget: 2000,    // Low token budget
            enableRecall: true,
            maxRecallContexts: 3,
            enableSummarization: true,
        },
    };

    const workspace = new VirtualWorkspace({
        name: 'example-workspace',
        description: 'Example workspace',
    });

    const apiClient: ApiClient = {
        makeRequest: async () => ({ } as any),
    };

    const agent = new Agent(config, workspace, {
        capability: 'You are a helpful AI assistant.',
        direction: 'Work efficiently.',
    }, apiClient);

    console.log('Memory module enabled: ', agent.hasMemoryModule());
    console.log('Reflective thinking: always enabled');
    console.log('Max thinking rounds: 1 (LLM controlled)');
    console.log('Token budget: 2000 (low)');
    console.log('\nThis mode performs minimal thinking for quick responses.');
}

/**
 * Example 5: Persistence
 */
async function example5_Persistence() {
    console.log('\n=== Example 5: Persistence ===\n');

    const config: AgentConfig = {
        apiRequestTimeout: 40000,
        maxRetryAttempts: 3,
        consecutiveMistakeLimit: 3,
        memory: {
            enableReflectiveThinking: true,
            maxThinkingRounds: 3,
            thinkingTokenBudget: 10000,
            enableRecall: true,
            maxRecallContexts: 3,
            enableSummarization: true,
        },
    };

    const workspace = new VirtualWorkspace({
        name: 'example-workspace',
        description: 'Example workspace',
    });

    const apiClient: ApiClient = {
        makeRequest: async () => ({ } as any),
    };

    // Create first agent and populate memory
    console.log('Creating first agent and populating memory...');
    const agent1 = new Agent(config, workspace, {
        capability: 'You are a helpful AI assistant.',
        direction: 'Think deeply before acting.',
    }, apiClient);

    const memoryModule1 = agent1.getMemoryModule();
    if (memoryModule1) {
        const turnStore = memoryModule1.getTurnStore();

        // Create Turn 1
        memoryModule1.startTurn('Context 1');
        memoryModule1.addUserMessage('Task 1');
        memoryModule1.recordToolCall('tool1', true, 'result1');
        memoryModule1.completeTurn();
        const turn1 = turnStore.getTurnByNumber(1);
        if (turn1) {
            turnStore.storeSummary(turn1.id, 'Summary 1', ['insight1']);
        }

        // Create Turn 2
        memoryModule1.startTurn('Context 2');
        memoryModule1.addUserMessage('Task 2');
        memoryModule1.recordToolCall('tool2', true, 'result2');
        memoryModule1.completeTurn();
        const turn2 = turnStore.getTurnByNumber(2);
        if (turn2) {
            turnStore.storeSummary(turn2.id, 'Summary 2', ['insight2']);
        }

        console.log(`  Stored ${turnStore.getCurrentTurnNumber()} turns`);

        // Export memory
        const exported = memoryModule1.export();
        console.log(`  Exported ${exported.turns.length} turns`);

        // Create second agent and import memory
        console.log('\nCreating second agent and importing memory...');
        const agent2 = new Agent(config, workspace, {
            capability: 'You are a helpful AI assistant.',
            direction: 'Think deeply before acting.',
        }, apiClient);

        const memoryModule2 = agent2.getMemoryModule();
        if (memoryModule2) {
            memoryModule2.import(exported);
            const store2 = memoryModule2.getTurnStore();
            console.log(`  Imported ${store2.getCurrentTurnNumber()} turns`);
            console.log(`  Summaries: ${store2.getAllSummaries().length}`);
        }
    }
}

/**
 * Run all examples
 */
async function runExamples() {
    try {
        await example1_BasicMemory();
        await example2_MemoryOperations();
        await example3_DynamicConfig();
        await example4_QuickThinking();
        await example5_Persistence();

        console.log('\n=== All examples completed ===');
    } catch (error) {
        console.error('Error running examples:', error);
    }
}

// Export examples
export {
    example1_BasicMemory,
    example2_MemoryOperations,
    example3_DynamicConfig,
    example4_QuickThinking,
    example5_Persistence,
    runExamples,
};
