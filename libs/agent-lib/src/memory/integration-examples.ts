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
        const memoryStore = memoryModule.getMemoryStore();
        console.log(`Total turns: ${memoryStore.getCurrentTurn()}`);
        console.log(`Total summaries: ${memoryStore.getAllSummaries().length}`);
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
            enableReflectiveThinking: true,
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

    const memoryStore = memoryModule.getMemoryStore();

    // Simulate multiple turns
    console.log('Simulating multiple turns...\n');

    // Turn 1
    const ctx1 = memoryStore.storeContext('Context 1: Initial analysis', ['analyze']);
    memoryStore.storeSummary(ctx1.id, 'Analyzed codebase structure', ['3 modules', 'Main entry']);
    console.log(`Turn 1: Stored context ${ctx1.id}`);

    // Turn 2
    const ctx2 = memoryStore.storeContext('Context 2: Deep dive', ['search', 'read']);
    memoryStore.storeSummary(ctx2.id, 'Found performance bottleneck', ['Bottleneck in utils', 'O(n²)']);
    console.log(`Turn 2: Stored context ${ctx2.id}`);

    // Turn 3
    const ctx3 = memoryStore.storeContext('Context 3: Optimization', ['edit', 'test']);
    memoryStore.storeSummary(ctx3.id, 'Implemented optimization', ['10x speedup', 'Tests passing']);
    console.log(`Turn 3: Stored context ${ctx3.id}`);

    // Get recent summaries
    console.log('\nRecent summaries:');
    const recentSummaries = memoryStore.getRecentSummaries(3);
    recentSummaries.forEach(s => {
        console.log(`  [Turn ${s.turnNumber}] ${s.summary}`);
        console.log(`    Insights: ${s.insights.join('; ')}`);
    });

    // Search by keyword
    console.log('\nSearch for "optimization":');
    const searchResults = memoryStore.searchSummaries('optimization');
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
    console.log(`Exported ${exported.contexts.length} contexts and ${exported.summaries.length} summaries`);
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
 * Example 4: Storage-only mode (no thinking)
 */
async function example4_StorageOnly() {
    console.log('\n=== Example 4: Storage-Only Mode ===\n');

    const config: AgentConfig = {
        apiRequestTimeout: 40000,
        maxRetryAttempts: 3,
        consecutiveMistakeLimit: 3,
        memory: {
            enableReflectiveThinking: false,  // Disable thinking
            maxThinkingRounds: 0,
            thinkingTokenBudget: 0,
            enableRecall: true,
            maxRecallContexts: 3,
            enableSummarization: true,        // Still generate summaries
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
    console.log('Reflective thinking: disabled');
    console.log('Context storage: enabled');
    console.log('Summarization: enabled');
    console.log('\nThis mode stores contexts and generates summaries without multi-round thinking.');
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
        const store = memoryModule1.getMemoryStore();
        const ctx1 = store.storeContext('Context 1', ['tool1']);
        store.storeSummary(ctx1.id, 'Summary 1', ['insight1']);
        const ctx2 = store.storeContext('Context 2', ['tool2']);
        store.storeSummary(ctx2.id, 'Summary 2', ['insight2']);

        console.log(`  Stored ${store.getCurrentTurn()} turns`);

        // Export memory
        const exported = memoryModule1.export();
        console.log(`  Exported ${exported.contexts.length} contexts`);

        // Create second agent and import memory
        console.log('\nCreating second agent and importing memory...');
        const agent2 = new Agent(config, workspace, {
            capability: 'You are a helpful AI assistant.',
            direction: 'Think deeply before acting.',
        }, apiClient);

        const memoryModule2 = agent2.getMemoryModule();
        if (memoryModule2) {
            memoryModule2.import(exported);
            const store2 = memoryModule2.getMemoryStore();
            console.log(`  Imported ${store2.getCurrentTurn()} turns`);
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
        await example4_StorageOnly();
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
    example4_StorageOnly,
    example5_Persistence,
    runExamples,
};
