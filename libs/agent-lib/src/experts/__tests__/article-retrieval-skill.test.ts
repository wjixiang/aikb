import { config } from 'dotenv'
config()

import { AgentFactory } from '../../agent/AgentFactory.js'
import { ObservableAgentFactory } from '../../agent/ObservableAgent.js'
import { MetaAnalysisWorkspace } from '../../workspaces/metaAnalysisWorkspace.js'
import { SkillRegistry } from '../../skills/index.js'
import { join } from 'path'

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
            const repositoryPath = join(__dirname, '../../../../skills/repository/builtin');
            console.log('Loading skills from:', repositoryPath);
            const skillRegistry = new SkillRegistry(repositoryPath);
            const skills = skillRegistry.getAll();
            console.log(`Loaded ${skills.length} skills:`, skills.map(s => s.name));
            workspace.registerSkills(skills);

            // Create base agent with minimal prompt (skill will provide enhancement)
            const baseAgent = AgentFactory.create(
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
                            console.log(`[Agent] Message added: ${message.role}`);
                        },
                        onTaskCompleted: (taskId) => {
                            console.log(`[Agent] Task ${taskId} completed successfully`);
                        },
                        onTaskAborted: (taskId, reason) => {
                            console.error(`[Agent] Task ${taskId} aborted: ${reason}`);
                        },
                        onError: (error, context) => {
                            console.error(`[Agent] Error in ${context}:`, error);
                        }
                    }
                }
            );

            // Wrap with ObservableAgentFactory for observation capabilities
            const agent = new ObservableAgentFactory()
                .onStatusChanged((taskId, status) => {
                    console.log(`[ArticleRetrieval] Task ${taskId} status changed to: ${status}`);
                })
                .onMessageAdded((taskId, message) => {
                    const roleColors = {
                        'user': '\x1b[36m',
                        'assistant': '\x1b[32m',
                        'system': '\x1b[33m',
                    };
                    const roleColor = roleColors[message.role as keyof typeof roleColors] || '\x1b[37m';
                    const timestamp = message.ts ? new Date(message.ts).toISOString() : new Date().toISOString();
                    console.log(`\n${roleColor}[${message.role.toUpperCase()}]${'\x1b[0m'} ${timestamp}`);
                })
                .onTaskCompleted((taskId) => {
                    console.log(`[ArticleRetrieval] Task ${taskId} completed successfully`);
                })
                .onTaskAborted((taskId, reason) => {
                    console.error(`[ArticleRetrieval] Task ${taskId} aborted: ${reason}`);
                })
                .onError((error, context) => {
                    console.error(`[ArticleRetrieval] Error in ${context}:`, error);
                })
                .create(baseAgent);

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

    }, 99999)
})
