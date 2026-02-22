import { describe, it, expect } from 'vitest'
import { config } from 'dotenv'
config()

import { AgentFactory } from '../AgentFactory.js'
import { MetaAnalysisWorkspace } from '../../workspaces/metaAnalysisWorkspace.js'
import { SkillRegistry } from '../../skills/index.js'
import { MessageContentFormatter } from '../../task/MessageFormatter.util.js'

describe("Article Retrieval Skill Integration", () => {
    it('should use article-retrieval skill for literature search', async () => {
        console.log('=== TEST STARTED ===');
        console.log('Timestamp:', new Date().toISOString());

        const query = 'In adult patients with type 2 diabetes mellitus, do SGLT2 inhibitors compared to placebo or standard care reduce the incidence of major adverse cardiovascular events and hospitalization for heart failure?';

        console.log('Query:', query);
        console.log('Creating agent with article-retrieval skill...');

        try {
            // Create workspace
            const workspace = new MetaAnalysisWorkspace();

            // Register skills - provide repository path to auto-load skills
            const skillRegistry = new SkillRegistry();
            const skills = skillRegistry.getAll();
            console.log(`Loaded ${skills.length} skills:`, skills.map(s => s.name));
            workspace.registerSkills(skills);

            // Create agent with observers - the DI container handles wrapping automatically
            const agent = AgentFactory.create(
                workspace,
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
                            console.log('message added')
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
                        onTurnCreated(turnId, turnNumber, workspaceContext, taskContext) {
                            console.log(`observed turn created: ${workspaceContext}`)
                        },
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

            // Check if article-retrieval skill was activated
            const activeSkill = workspace.getSkillManager().getActiveSkill();
            if (activeSkill) {
                console.log('Active skill:', activeSkill.displayName);
                console.log('Skill capability:', activeSkill.prompt.capability.substring(0, 100) + '...');
            } else {
                console.log('No skill was activated');
            }
        } catch (error) {
            console.error('ERROR during test execution:', error);
            console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
            throw error;
        }

        console.log('=== TEST COMPLETED ===');

    }, 999999)
})
