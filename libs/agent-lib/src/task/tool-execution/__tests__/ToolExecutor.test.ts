import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ToolExecutor } from '../ToolExecutor';
import { ToolCallingHandler, ToolNotFoundError } from '../../../tools';
import { ToolName } from '../../../types';
import { ToolUse } from '../../../assistant-message/assistantMessageTypes';

describe('ToolExecutor', () => {
    let toolExecutor: ToolExecutor;
    let mockToolCallHandler: ToolCallingHandler;

    beforeEach(() => {
        // Create a mock ToolCallingHandler
        mockToolCallHandler = {
            handleToolCalling: vi.fn(),
        } as unknown as ToolCallingHandler;

        toolExecutor = new ToolExecutor(mockToolCallHandler);
    });

    describe('executeToolCalls', () => {
        it('should throw ToolNotFoundError when the used tool does not exist in toolset', async () => {
            const toolUseBlocks: ToolUse[] = [
                {
                    type: 'tool_use',
                    name: 'non_existent_tool' as ToolName,
                    params: {},
                    id: 'tool-call-id-1',
                },
            ];

            const isAborted = () => false;

            // Mock handleToolCalling to throw ToolNotFoundError for non-existent tool
            vi.mocked(mockToolCallHandler.handleToolCalling).mockRejectedValue(
                new ToolNotFoundError('Tool "non_existent_tool" not found'),
            );

            await expect(
                toolExecutor.executeToolCalls(toolUseBlocks, isAborted),
            ).rejects.toThrow(ToolNotFoundError);
        });
    });
});
