/**
 * Unit tests for ActionModule with action phase guidance
 * Tests that the action phase guidance is properly included in the prompt
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Container } from 'inversify';
import { TYPES } from '../../di/types.js';
import { ActionModule } from '../ActionModule.js';
import type { IActionModule } from '../types.js';
import type { ApiClient } from '../../api-client/index.js';
import type { IToolManager } from '../../tools/index.js';
import type { ITurnMemoryStore } from '../../memory/TurnMemoryStore.interface.js';
import type { ChatCompletionTool } from '../../api-client/index.js';
import pino from 'pino';
import { generateActionPhaseGuidance } from '../../prompts/sections/actionPhaseGuidance.js';

describe('ActionModule - Action Phase Guidance', () => {
    let container: Container;
    let actionModule: IActionModule;
    let mockApiClient: ApiClient;
    let mockToolManager: IToolManager;
    let mockTurnMemoryStore: ITurnMemoryStore;
    let mockLogger: any;
    let capturedPrompts: Array<{
        systemPrompt: string;
        workspaceContext: string;
        memoryContext: string[];
        tools: ChatCompletionTool[] | undefined;
    }>;

    beforeEach(() => {
        // Reset captured prompts
        capturedPrompts = [];

        // Create container
        container = new Container();

        // Create mock logger
        mockLogger = pino({ level: 'silent' });

        // Create mock ApiClient that captures prompts
        mockApiClient = {
            makeRequest: vi.fn().mockImplementation(
                (systemPrompt: string, workspaceContext: string, memoryContext: string[], timeoutConfig: any, tools?: ChatCompletionTool[]) => {
                    // Capture the prompt for inspection
                    capturedPrompts.push({
                        systemPrompt,
                        workspaceContext,
                        memoryContext,
                        tools,
                    });

                    // Return mock response with a tool call
                    return Promise.resolve({
                        toolCalls: [{
                            id: 'test-call-1',
                            call_id: 'test-call-id-1',
                            type: 'function_call',
                            name: 'attempt_completion',
                            arguments: JSON.stringify({ result: 'Task completed successfully' })
                        }],
                        textResponse: 'Task completed',
                        requestTime: 100,
                        tokenUsage: {
                            promptTokens: 100,
                            completionTokens: 50,
                            totalTokens: 150,
                        },
                    });
                }
            ),
        } as any;

        // Create mock ToolManager
        mockToolManager = {
            executeTool: vi.fn(),
        } as any;

        // Create mock TurnMemoryStore
        mockTurnMemoryStore = {
            getTurnByNumber: vi.fn(),
            getRecentMessages: vi.fn(),
            getAllMessages: vi.fn(),
        } as any;

        // Bind dependencies
        container.bind(TYPES.Logger).toConstantValue(mockLogger);
        container.bind(TYPES.ApiClient).toConstantValue(mockApiClient);
        container.bind(TYPES.IToolManager).toConstantValue(mockToolManager);
        container.bind(TYPES.ITurnMemoryStore).toConstantValue(mockTurnMemoryStore);
        container.bind(TYPES.MemoryModuleConfig).toConstantValue({
            enableRecall: true,
            maxRecallContexts: 3,
            maxRecalledMessages: 20,
        });
        container.bind(TYPES.IActionModule).to(ActionModule);

        // Resolve ActionModule
        actionModule = container.get<IActionModule>(TYPES.IActionModule);
    });

    describe('Action phase guidance in prompt', () => {
        it('should include action phase guidance when thinking summary is provided', async () => {
            const thinkingSummary = `[Reflective Thinking Phase]
Total rounds: 2
Tokens used: 50

Thinking rounds:
  Round 1: I need to analyze this task. The user wants to search for articles about diabetes treatment. I should activate the meta-analysis skill.
  Round 2: My plan is: 1) Activate meta-analysis-article-retrieval skill, 2) Search for articles, 3) Review results.`;

            const enhancedSystemPrompt = `${generateActionPhaseGuidance(thinkingSummary)}\n\nYou are a helpful assistant.`;

            await actionModule.performActionPhase(
                'test workspace',
                enhancedSystemPrompt,
                [],
                [],
                () => false
            );

            expect(capturedPrompts).toHaveLength(1);
            const prompt = capturedPrompts[0];

            console.log('\n========== ACTION PHASE GUIDANCE IN PROMPT ==========');
            console.log('\n--- SYSTEM PROMPT (First 500 chars) ---');
            console.log(prompt.systemPrompt.substring(0, 500) + '...');
            console.log('\n--- Full System Prompt Length ---');
            console.log(`${prompt.systemPrompt.length} characters`);
            console.log('\n====================================================\n');

            // Verify action phase guidance is included
            expect(prompt.systemPrompt).toContain('ACTION PHASE GUIDANCE');
            expect(prompt.systemPrompt).toContain('THINKING PHASE PLAN');
            expect(prompt.systemPrompt).toContain('Round 1: I need to analyze this task');
            expect(prompt.systemPrompt).toContain('FOLLOW THE PLAN');
            expect(prompt.systemPrompt).toContain('MULTIPLE TOOLS');
        });

        it('should include generic action phase guidance when no thinking summary is provided', async () => {
            const enhancedSystemPrompt = `${generateActionPhaseGuidance(undefined)}\n\nYou are a helpful assistant.`;

            await actionModule.performActionPhase(
                'test workspace',
                enhancedSystemPrompt,
                [],
                [],
                () => false
            );

            expect(capturedPrompts).toHaveLength(1);
            const prompt = capturedPrompts[0];

            console.log('\n========== GENERIC ACTION PHASE GUIDANCE ==========');
            console.log('\n--- SYSTEM PROMPT (First 500 chars) ---');
            console.log(prompt.systemPrompt.substring(0, 500) + '...');
            console.log('\n================================================\n');

            // Verify action phase guidance is included but without thinking plan
            expect(prompt.systemPrompt).toContain('ACTION PHASE GUIDANCE');
            expect(prompt.systemPrompt).not.toContain('THINKING PHASE PLAN');
            expect(prompt.systemPrompt).toContain('ACCOMPLISH THE TASK');
            expect(prompt.systemPrompt).toContain('MULTIPLE TOOLS');
        });

        it('should display the complete action phase guidance structure', async () => {
            const thinkingSummary = `[Reflective Thinking Phase]
Total rounds: 1
Tokens used: 30

Thinking rounds:
  Round 1: Plan to search PubMed for diabetes treatment articles.`;

            const guidance = generateActionPhaseGuidance(thinkingSummary);

            console.log('\n========== COMPLETE ACTION PHASE GUIDANCE ==========');
            console.log(guidance);
            console.log('\n==================================================\n');

            // Verify key sections are present
            expect(guidance).toContain('📋 THINKING PHASE PLAN 📋');
            expect(guidance).toContain('⚠️ ACTION PHASE GUIDANCE ⚠️');
            expect(guidance).toContain('YOUR INSTRUCTIONS');
            expect(guidance).toContain('📋 FOLLOW THE PLAN');
            expect(guidance).toContain('🛠️ USE MULTIPLE TOOLS IN ONE MESSAGE');
            expect(guidance).toContain('📊 REPORT PROGRESS');
            expect(guidance).toContain('🔄 ADAPT IF NEEDED');
            expect(guidance).toContain('✅ COMPLETE THE TASK');
            expect(guidance).toContain('EXECUTION GUIDELINES');
            expect(guidance).toContain('RESPONSE FORMAT');
        });
    });
});
