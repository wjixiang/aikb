#!/usr/bin/env tsx
/**
 * Isolate test to diagnose the exact hanging issue
 */

import { describe, it, expect } from 'vitest';
import { b } from '../baml_client';
import { KmsWorkspace } from './workspaces/KmsWorkspace';
import { AgentV2, defaultAgentConfig, defaultApiConfig } from './agentV2';
import { ProviderSettings } from '../types/provider-settings';
import { config } from 'dotenv';
config();

describe('AgentV2 Isolate Test', () => {
    it.only('should reproduce the hanging issue', async () => {
        console.log('[TEST] Step 1: Creating workspace...');
        const workspace = new KmsWorkspace();

        // console.log('[TEST] Step 2: Creating agent...');
        // const apiConfig: ProviderSettings = {
        //     ...defaultApiConfig,
        //     apiKey: process.env['GLM_API_KEY'] || 'test-key',
        // };
        // const agent = new AgentV2(defaultAgentConfig, apiConfig, workspace, 'test-task-id');

        // console.log('[TEST] Step 3: Getting system prompt...');
        // const systemPrompt = await agent.getSystemPrompt();
        // console.log('[TEST] System prompt length:', systemPrompt.length);

        // console.log('[TEST] Step 4: Getting workspace context...');
        // const workspaceContext = await workspace.render();
        // console.log('[TEST] Workspace context length:', workspaceContext.length);

        // console.log('[TEST] Step 5: Building conversation history...');
        // const cleanConversationHistory = agent.buildCleanConversationHistory([]);
        // console.log('[TEST] Conversation history:', cleanConversationHistory);

        // console.log('[TEST] Step 6: Converting to memory context...');
        // const memoryContext = cleanConversationHistory.map((msg: any) => {
        //     const role = msg.role === 'user' ? 'user' : 'assistant';
        //     const content = typeof msg.content === 'string'
        //         ? msg.content
        //         : msg.content.map((block: any) => {
        //             if (block.type === 'text') {
        //                 return block.text;
        //             } else if (block.type === 'tool_use') {
        //                 return `<tool_use name="${block.name}" id="${block.id}">${JSON.stringify(block.input)}</tool_use>`;
        //             } else if (block.type === 'tool_result') {
        //                 return `<tool_result tool_use_id="${block.tool_use_id}">${block.content}</tool_result>`;
        //             }
        //             return '';
        //         }).join('\n');
        //     return `<${role}>\n${content}\n</${role}>`;
        // });
        // console.log('[TEST] Memory context length:', memoryContext.length);

        // console.log('[TEST] Step 7: Setting up timeout...');
        // const timeoutId = setTimeout(() => {
        //     console.error('[TEST] TIMEOUT TRIGGERED!');
        // }, 5000);

        console.log('[TEST] Step 8: Calling b.ApiRequest...');
        try {
            const result = await b.ApiRequest(
                "systemPrompt",
                "workspaceContext",
                ["memoryContext"]
            );
            // clearTimeout(timeoutId);
            console.log('[TEST] b.ApiRequest returned:', result);
            expect(result).toBeDefined();
        } catch (error) {
            // clearTimeout(timeoutId);
            console.log('[TEST] b.ApiRequest error:', error);
            throw error;
        }
    }, 120000);

    it('should work with simple context', async () => {
        console.log('[TEST] Simple test with minimal context...');
        const result = await b.ApiRequest('test', 'hello', []);
        console.log('[TEST] Result:', result);
        expect(result).toBeDefined();
    }, 30000);
});
