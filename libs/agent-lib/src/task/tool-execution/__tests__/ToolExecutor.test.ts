import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ToolExecutor } from '../ToolExecutor';
import { VirtualWorkspace } from 'statefulContext';
import { ToolName } from '../../../types';
import { ToolUse } from '../../../assistant-message/assistantMessageTypes';

describe('ToolExecutor', () => {
    let toolExecutor: ToolExecutor;
    let mockWorkspace: VirtualWorkspace;

    beforeEach(() => {
        // Create a mock VirtualWorkspace
        mockWorkspace = {
            registerComponent: vi.fn(),
            unregisterComponent: vi.fn(),
            getComponent: vi.fn(),
            getComponentKeys: vi.fn(),
            renderToolBox: vi.fn(),
            getConfig: vi.fn(() => ({ id: 'test-workspace', name: 'Test Workspace' })),
        } as unknown as VirtualWorkspace;

        toolExecutor = new ToolExecutor(mockWorkspace);
    });

    describe('executeToolCalls', () => {
        it('should handle tool calls successfully', async () => {
            const toolUseBlocks: ToolUse[] = [
                {
                    type: 'tool_use',
                    name: 'attempt_completion' as ToolName,
                    params: {},
                    id: 'tool-call-id-1',
                },
            ];

            const isAborted = () => false;

            const result = await toolExecutor.executeToolCalls(toolUseBlocks, isAborted);

            expect(result).toBeDefined();
            expect(result.didAttemptCompletion).toBe(true);
            expect(result.userMessageContent).toEqual([]);
        });

        it('should track tool usage', async () => {
            const toolUseBlocks: ToolUse[] = [
                {
                    type: 'tool_use',
                    name: 'test_tool' as ToolName,
                    params: {},
                    id: 'tool-call-id-1',
                },
            ];

            const isAborted = () => false;

            const result = await toolExecutor.executeToolCalls(toolUseBlocks, isAborted);

            expect(result).toBeDefined();
            expect(result.toolUsage).toHaveProperty('test_tool');
        });
    });
});
