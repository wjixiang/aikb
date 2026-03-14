/**
 * Integration tests for ActionModule with real agent prompt structure
 * Tests to verify the complete prompt structure with realistic agent prompts
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
import type { ApiMessage } from '../../task/task.type.js';
import pino from 'pino';
import { generateActionPhaseGuidance } from '../../prompts/sections/actionPhaseGuidance.js';

describe('ActionModule - Real Prompt Structure', () => {
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
            getToolSource: vi.fn().mockReturnValue({ source: 'component', providerId: 'component:test', componentKey: 'test' }),
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

    describe('Real agent prompt structure', () => {
        it('should display complete prompt with action phase guidance and thinking summary', async () => {
            // Simulate a realistic workspace context
            const workspaceContext = `
===
Tool-Based Workspace Interface Guide

You are an AI assistant working with a workspace system. The workspace contains components that expose tools for you to call.

## CRITICAL: Workspace Context Awareness

**You MUST actively analyze and respond to the workspace context provided to you.**

The workspace context is the CURRENT STATE of all components and contains:
- Component names and their current data/state
- Available tools with their descriptions and parameters
- Results from previous tool calls
- Any errors or warnings

**Before making any tool call, you MUST:**
1. Carefully read the entire workspace context
2. Identify which components are relevant to your task
3. Check the current state of each component
4. Understand what data is already available
5. Determine what actions are needed based on the current state

**After each tool call, the workspace context will be updated with:**
- New data or state changes
- Tool execution results
- Any errors or warnings

**You MUST review these updates and adjust your strategy accordingly.**

## Available Tools
The workspace consists of multiple components, each with its own set of tools. Tools are displayed in the workspace context with:
- Tool name
- Description of what the tool does
- Parameters (with types and descriptions)
- Which component the tool belongs to

## How to Use Tools
When you need to perform an action:
1. First, analyze the current workspace context to understand the state
2. Use the <call_tool> function with the following parameters:
   - toolName: The name of the tool to call
   - toolParams: A JSON string containing the parameters for the tool
3. The tool will be executed on the component
4. If successful, the component's state will be updated and re-rendered
5. If the tool call fails, you will receive an error message

\`\`\`

## Important Notes
- Each tool has specific parameters that must be provided
- Parameters should be passed as a JSON string
- Check the tool description in the workspace context for required and optional parameters
- **Always check the current workspace state before making tool calls**
- **After each tool call, review the updated workspace context before deciding on next actions**
- When your task is complete, use the <attempt_completion> function

`;

            // Simulate a thinking phase result similar to what article-retrieval-skill.ts would generate
            const thinkingSummary = `[Reflective Thinking Phase]
Total rounds: 2
Tokens used: 50

Thinking rounds:
  Round 1: I need to analyze this task. The user wants to conduct a meta-analysis on mesenchymal stem cells injection for knee osteoarthritis. I should activate the meta-analysis-article-retrieval skill.
  Round 2: My plan is: 1) Activate meta-analysis-article-retrieval skill, 2) Search PubMed for relevant articles, 3) Review the results, 4) Generate a standardized search strategy.`;

            // Simulate a realistic system prompt like the one used in article-retrieval-skill.ts
            const baseSystemPrompt = `
╔══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════ literal.`;

            // Generate action phase guidance with thinking summary
            const actionPhaseGuidance = generateActionPhaseGuidance(thinkingSummary);

            // Prepend action phase guidance to system prompt
            const enhancedSystemPrompt = actionPhaseGuidance + baseSystemPrompt;

            // Perform action phase
            await actionModule.performActionPhase(
                workspaceContext,
                enhancedSystemPrompt,
                [],
                [],
                () => false
            );

            // Verify prompt was captured
            expect(capturedPrompts).toHaveLength(1);
            const prompt = capturedPrompts[0];

            // Display complete prompt structure
            console.log('\n========== COMPLETE PROMPT STRUCTURE ==========');
            console.log('\n--- SYSTEM PROMPT (First 500 chars) ---');
            console.log(prompt.systemPrompt.substring(0, 500) + '...');
            console.log('\n--- SYSTEM PROMPT LENGTH ---');
            console.log(`${prompt.systemPrompt.length} characters`);
            console.log('\n--- WORKSPACE CONTEXT ---');
            console.log(prompt.workspaceContext.substring(0, 500) + '...');
            console.log('\n--- MEMORY CONTEXT ---');
            prompt.memoryContext.forEach((item, index) => {
                console.log(`\n[${index + 1}] ${item}`);
            });
            console.log('\n--- TOOLS ---');
            if (prompt.tools && prompt.tools.length > 0) {
                prompt.tools.forEach((tool, index) => {
                    if (tool.type === 'function') {
                        console.log(`\n[${index + 1}] Tool: ${tool.function.name}`);
                        console.log(`    Description: ${tool.function.description}`);
                    } else {
                        console.log(`\n[${index + 1}] Custom Tool: ${tool.custom.name}`);
                        console.log(`    Description: ${tool.custom.description || 'No description'}`);
                    }
                });
            }
            console.log('\n==================================================\n');

            // Verify structure - check for actual content in the prompt
            expect(prompt.systemPrompt).toContain('ACTION PHASE GUIDANCE');
            expect(prompt.systemPrompt).toContain('THINKING PHASE PLAN');
            expect(prompt.systemPrompt).toContain('FOLLOW THE PLAN');
            expect(prompt.systemPrompt).toContain('MULTIPLE TOOLS');
        });
    });
});
