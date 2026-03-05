import { config } from 'dotenv'
config()

import 'reflect-metadata'
import { AgentFactory } from '../src/agent/AgentFactory.js'
import { SkillRegistry } from '../src/skills/index.js'
import { MessageContentFormatter } from '../src/task/MessageFormatter.util.js'

async function main() {
    console.log('=== SCRIPT STARTED ===');
    console.log('Timestamp:', new Date().toISOString());

    const query = '请你对针对该选题进行meta分析: Efficacy of mesenchymal stem cells injection for the management of knee osteoarthritis';

    console.log('Query:', query);
    console.log('Creating agent with meta-analysis skill (workspace will be created internally)...');

    try {
        // Register skills - the meta-analysis-with-components skill will auto-register its components
        const skillRegistry = new SkillRegistry();
        const skills = skillRegistry.getAll();
        console.log(`Loaded ${skills.length} skills:`, skills.map(s => s.name));

        // Create agent without passing workspace - it will be created internally
        // Components will be automatically registered when a skill is activated
        const agent = AgentFactory.createWithContainer(
            {
                capability: 'You are a helpful AI assistant.',
                direction: 'Follow the user\'s instructions and use available tools to complete tasks.'
            },
            {
                observers: {
                    onStatusChanged: (taskId, status) => {
                        console.log(`[Agent] Task ${taskId} status changed to: ${status}`);
                    },
                    onMessageAdded: (taskId, message) => {
                        // console.log('message added')
                        console.log(MessageContentFormatter.formatForLogging(message, {
                            maxLength: 99999,
                            includeMetadata: true,
                            colorize: true
                        }));
                    },
                    onTaskCompleted: (taskId) => {
                        console.log(`[Agent] Task ${taskId} completed successfully`);
                    },
                    onTaskAborted: (taskId, reason) => {
                        console.error(`[Agent] Task ${taskId} aborted: ${reason}`);
                    },
                    onError: (error, context) => {
                        console.error(`[Agent] Error in ${context}:`, error);
                    },
                    onTurnCreated: (turnId, turnNumber, workspaceContext, taskContext) => {
                        console.log(`observed turn created: ${workspaceContext}`)
                    },
                },
                apiConfiguration: {
                    apiProvider: 'zai',
                    apiModelId: 'glm-4.5-air',
                    apiKey: process.env['GLM_API_KEY'] || '',
                },
                config: {
                    apiRequestTimeout: 90000
                }
            }
        );

        console.log('Calling agent.start()...');
        const result = await agent.start(query);
        console.log('Start method returned, result:', result);
        console.log('Agent status after start:', result.status);
        console.log('Agent task ID:', result.getTaskId);
        console.log('Conversation history length:', result.conversationHistory.length);
        console.log('Token usage:', result.tokenUsage);
        console.log('Tool usage:', result.toolUsage);
        console.log('Consecutive mistake count:', result.consecutiveMistakeCount);
        console.log('Collected errors:', result.getCollectedErrors());

        // Debug: Check the conversation history for system messages with thinking summary
        const systemMessages = result.conversationHistory.filter(m => m.role === 'system');
        console.log('\n=== DEBUG: System Messages ===');
        systemMessages.forEach((msg, idx) => {
            const content = msg.content.find(b => b.type === 'text')?.text || '';
            console.log(`\n--- System Message ${idx + 1} ---`);
            console.log(content);
            console.log(`--- End System Message ${idx + 1} ---\n`);
        });

        // Check if a skill was activated
        const activeSkill = agent.workspace.getSkillManager().getActiveSkill();
        if (activeSkill) {
            console.log('Active skill:', activeSkill.displayName);
            console.log('Skill capability:', activeSkill.prompt.capability.substring(0, 100) + '...');

            // Check auto-registered components
            console.log('\n=== Auto-Registered Components ===');
            const componentKeys = agent.workspace.getComponentKeys();
            console.log('Components registered:', componentKeys.length);
            componentKeys.forEach((key: string) => {
                console.log(`  - ${key}`);
            });

            // Show component count from skill manager
            const activeComponentCount = agent.workspace.getSkillManager().getActiveComponentCount();
            console.log(`\nActive components from skill: ${activeComponentCount}`);
        } else {
            console.log('No skill was activated');
        }
    } catch (error) {
        console.error('ERROR during script execution:', error);
        console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
        process.exit(1);
    }

    console.log('=== SCRIPT COMPLETED ===');
}

main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
});
