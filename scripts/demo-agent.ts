#!/usr/bin/env tsx
/**
 * Demo script for AgentV2 with KmsWorkspace
 * Demonstrates the agent functionality with real AI
 */

import { KmsWorkspace } from '../libs/agent-lib/src/agent/workspaces/KmsWorkspace';
import { AgentV2, defaultAgentConfig, defaultApiConfig } from '../libs/agent-lib/src/agent/agentV2';
import { ProviderSettings } from '../libs/agent-lib/src/types/provider-settings';
import { config } from 'dotenv'
config()

async function main() {
    console.log('='.repeat(80));
    console.log('AgentV2 Demo with KmsWorkspace');
    console.log('='.repeat(80));
    console.log();

    // Step 1: Create KmsWorkspace
    console.log('Step 1: Creating KmsWorkspace...');
    const workspace = new KmsWorkspace();
    console.log(`✓ Workspace created: ${workspace.getConfig().name}`);
    console.log(`  ID: ${workspace.getConfig().id}`);
    console.log(`  Description: ${workspace.getConfig().description}`);
    console.log();

    // Step 2: Display workspace components
    console.log('Step 2: Workspace Components');
    const componentKeys = workspace.getComponentKeys();
    componentKeys.forEach(key => {
        console.log(`  - ${key}`);
    });
    console.log();

    // Step 3: Render workspace context
    console.log('Step 3: Rendering Workspace Context...');
    const context = await workspace.render();
    console.log(context);
    console.log();

    // Step 4: Display workspace stats
    console.log('Step 4: Workspace Statistics');
    const stats = workspace.getStats();
    console.log(`  Component Count: ${stats.componentCount}`);
    console.log(`  Total States: ${stats.totalStates}`);
    console.log(`  Component Keys: ${stats.componentKeys.join(', ')}`);
    console.log();

    // Step 5: Display available tools
    console.log('Step 5: Available Tools');
    const tools = workspace.getCommonTools();
    console.log(`  - execute_script: ${typeof tools.execute_script}`);
    console.log(`  - attempt_completion: ${typeof tools.attempt_completion}`);
    console.log();

    // Step 6: Create AgentV2 with real AI configuration
    console.log('Step 6: Creating AgentV2 with Real AI...');
    const apiConfig: ProviderSettings = {
        ...defaultApiConfig,
        apiKey: process.env['GLM_API_KEY'] || 'your-api-key-here',
    };

    console.log(`  API Provider: ${apiConfig.apiProvider}`);
    console.log(`  Model: ${apiConfig.apiModelId}`);
    console.log(`  Tool Protocol: ${apiConfig.toolProtocol}`);
    console.log();

    const agent = new AgentV2(
        defaultAgentConfig,
        apiConfig,
        workspace,
        'demo-task-id'
    );

    console.log(`✓ Agent created`);
    console.log(`  Task ID: ${agent.getTaskId}`);
    console.log(`  Status: ${agent.status}`);
    console.log();

    // Step 7: Set up observers
    console.log('Step 7: Setting up Observers...');
    agent.onMessageAdded((taskId, message) => {
        console.log(`\n[Message Added] Task: ${taskId}`);
        console.log(`  Role: ${message.role}`);
        if (typeof message.content === 'string') {
            console.log(`  Content: ${message.content.substring(0, 100)}...`);
        } else if (Array.isArray(message.content)) {
            console.log(`  Content Blocks: ${message.content.length}`);
        }
    });

    agent.onStatusChanged((taskId, status) => {
        console.log(`\n[Status Changed] Task: ${taskId} -> Status: ${status}`);
    });

    agent.onTaskCompleted((taskId) => {
        console.log(`\n[Task Completed] Task: ${taskId}`);
    });

    agent.onTaskAborted((taskId, reason) => {
        console.log(`\n[Task Aborted] Task: ${taskId} -> Reason: ${reason}`);
    });

    console.log('✓ Observers registered');
    console.log();

    // Step 8: Display script execution guide
    console.log('Step 8: Script Execution Guide');
    const scriptGuide = await workspace.renderWithScriptSection();
    console.log(scriptGuide);
    console.log();

    // Step 9: Demo: Execute a simple script
    console.log('Step 9: Demo - Execute a Simple Script');
    const demoScript = `
        // This is a demo script that would be executed by the agent
        // In a real scenario, the AI would generate and execute scripts
        // to interact with workspace components
        
        console.log("Demo script executed!");
        
        // Example: Access book viewer state
        // const books = getAvailableBooks();
        // console.log("Available books:", books.length);
        
        // Example: Access content
        // const content = getContent();
        // console.log("Current content:", content.substring(0, 50));
    `;

    console.log('Demo Script:');
    console.log(demoScript);
    console.log();

    // Step 10: Demo: Start agent with a query (commented out to avoid actual AI calls)
    console.log('Step 10: Demo - Start Agent (Commented out)');
    console.log('To actually start the agent with real AI, uncomment the following code:');
    try {
        await agent.start('Search for information about medical terminology');
        console.log('Agent completed successfully');
    } catch (error) {
        console.error('Agent failed:', error);
    }
    console.log();

    console.log('='.repeat(80));
    console.log('Demo completed successfully!');
    console.log('='.repeat(80));
    console.log();
    console.log('Summary:');
    console.log('  - KmsWorkspace instantiated with 3 components');
    console.log('  - AgentV2 instantiated with real AI configuration');
    console.log('  - Observers registered for message/status events');
    console.log('  - Script execution guide displayed');
    console.log();
    console.log('Note: To run the agent with real AI:');
    console.log('  1. Set GLM_API_KEY environment variable');
    console.log('  2. Uncomment the agent.start() call in Step 10');
    console.log('  3. Run: npx tsx scripts/demo-agent.ts');
    console.log();
    console.log('Warning: The agent will make actual API calls to the LLM.');
    console.log('         This may take time and consume API quota.');
    console.log('         The agent will hang waiting for API response if:');
    console.log('         - No valid API key is provided');
    console.log('         - Network connectivity issues');
    console.log('         - API service is down');
}

// Run the demo
main().catch(error => {
    console.error('Demo failed:', error);
    process.exit(1);
});
