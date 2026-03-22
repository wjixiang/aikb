/**
 * ToolManager Tests
 *
 * Tests for the simplified tool management (without Skill system)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ToolManager } from '../ToolManager.js';
import type { IToolProvider } from '../IToolProvider.js';
import type { Tool } from '../../statefulContext/types.js';
import { z } from 'zod';
import { HookType } from '../../hooks/types.js';
import type { HookModule } from '../../hooks/HookModule.js';

describe('ToolManager (Simplified)', () => {
    let toolManager: ToolManager;
    let mockHookModule: HookModule;

    // Mock tool provider
    const createMockToolProvider = (id: string, tools: Tool[]): IToolProvider => ({
        id,
        priority: 0,
        getTools: () => tools,
        getTool: (name: string) => tools.find(t => t.toolName === name),
        hasTool: (name: string) => tools.some(t => t.toolName === name),
        getToolNames: () => tools.map(t => t.toolName),
        executeTool: vi.fn(),
    });

    beforeEach(() => {
        // Create mock HookModule
        mockHookModule = {
            executeHooks: vi.fn().mockResolvedValue(undefined),
            registerHook: vi.fn(),
            unregisterHook: vi.fn(),
            getRegisteredHooks: vi.fn().mockReturnValue([]),
        } as unknown as HookModule;

        toolManager = new ToolManager(mockHookModule, 'test-instance-id');
    });

    describe('Provider Registration', () => {
        it('should register a provider', () => {
            const provider = createMockToolProvider('test-provider', []);
            toolManager.registerProvider(provider);

            expect(toolManager.getProvider('test-provider')).toBe(provider);
        });

        it('should unregister a provider', () => {
            const provider = createMockToolProvider('test-provider', []);
            toolManager.registerProvider(provider);

            const result = toolManager.unregisterProvider('test-provider');
            expect(result).toBe(true);
            expect(toolManager.getProvider('test-provider')).toBeUndefined();
        });

        it('should get all provider IDs', () => {
            toolManager.registerProvider(createMockToolProvider('provider-1', []));
            toolManager.registerProvider(createMockToolProvider('provider-2', []));

            const ids = toolManager.getProviderIds();
            expect(ids).toContain('provider-1');
            expect(ids).toContain('provider-2');
        });
    });

    describe('Tool Management', () => {
        it('should get all registered tools', () => {
            const tools: Tool[] = [
                { toolName: 'tool1', paramsSchema: z.object({}), desc: 'Tool 1' },
                { toolName: 'tool2', paramsSchema: z.object({}), desc: 'Tool 2' },
            ];
            const provider = createMockToolProvider('test-provider', tools);
            toolManager.registerProvider(provider);

            const allTools = toolManager.getAllTools();
            expect(allTools.length).toBe(2);
            expect(allTools.find(t => t.tool.toolName === 'tool1')).toBeDefined();
        });

        it('should get available tools', () => {
            const tools: Tool[] = [
                { toolName: 'tool1', paramsSchema: z.object({}), desc: 'Tool 1' },
            ];
            const provider = createMockToolProvider('test-provider', tools);
            toolManager.registerProvider(provider);

            const availableTools = toolManager.getAvailableTools();
            expect(availableTools.length).toBe(1);
            expect(availableTools[0].toolName).toBe('tool1');
        });

        it('should check if tool is enabled', () => {
            const tools: Tool[] = [
                { toolName: 'tool1', paramsSchema: z.object({}), desc: 'Tool 1' },
            ];
            const provider = createMockToolProvider('test-provider', tools);
            toolManager.registerProvider(provider);

            expect(toolManager.isToolEnabled('tool1')).toBe(true);
            expect(toolManager.isToolEnabled('nonexistent')).toBe(false);
        });

        it('should enable and disable tools', () => {
            const tools: Tool[] = [
                { toolName: 'tool1', paramsSchema: z.object({}), desc: 'Tool 1' },
            ];
            const provider = createMockToolProvider('test-provider', tools);
            toolManager.registerProvider(provider);

            toolManager.disableTool('tool1');
            expect(toolManager.isToolEnabled('tool1')).toBe(false);

            toolManager.enableTool('tool1');
            expect(toolManager.isToolEnabled('tool1')).toBe(true);
        });

        it('should get tool count', () => {
            const tools: Tool[] = [
                { toolName: 'tool1', paramsSchema: z.object({}), desc: 'Tool 1' },
                { toolName: 'tool2', paramsSchema: z.object({}), desc: 'Tool 2' },
            ];
            const provider = createMockToolProvider('test-provider', tools);
            toolManager.registerProvider(provider);

            const count = toolManager.getToolCount();
            expect(count.total).toBe(2);
            expect(count.enabled).toBe(2);
            expect(count.disabled).toBe(0);
        });
    });

    describe('Tool Execution', () => {
        it('should execute a tool', async () => {
            const executeTool = vi.fn().mockResolvedValue({ result: 'success' });
            const tools: Tool[] = [
                { toolName: 'tool1', paramsSchema: z.object({}), desc: 'Tool 1' },
            ];
            const provider: IToolProvider = {
                id: 'test-provider',
                priority: 0,
                getTools: () => tools,
                getTool: (name: string) => tools.find(t => t.toolName === name),
                hasTool: (name: string) => tools.some(t => t.toolName === name),
                getToolNames: () => tools.map(t => t.toolName),
                executeTool,
            };
            toolManager.registerProvider(provider);

            const result = await toolManager.executeTool('tool1', { param: 'value' });

            expect(executeTool).toHaveBeenCalledWith('tool1', { param: 'value' });
        });

        it('should throw error for nonexistent tool', async () => {
            await expect(toolManager.executeTool('nonexistent', {}))
                .rejects.toThrow("not found");
        });

        it('should throw error for disabled tool', async () => {
            const tools: Tool[] = [
                { toolName: 'tool1', paramsSchema: z.object({}), desc: 'Tool 1' },
            ];
            const provider = createMockToolProvider('test-provider', tools);
            toolManager.registerProvider(provider);

            toolManager.disableTool('tool1');

            await expect(toolManager.executeTool('tool1', {}))
                .rejects.toThrow('disabled');
        });
    });

    describe('Tool Source', () => {
        it('should get tool source info', () => {
            const tools: Tool[] = [
                { toolName: 'tool1', paramsSchema: z.object({}), desc: 'Tool 1' },
            ];
            const provider = createMockToolProvider('test-provider', tools);
            toolManager.registerProvider(provider);

            const source = toolManager.getToolSource('tool1');
            expect(source).toBeDefined();
            expect(source?.providerId).toBe('test-provider');
        });

        it('should return null for nonexistent tool', () => {
            const source = toolManager.getToolSource('nonexistent');
            expect(source).toBeNull();
        });
    });

    describe('Availability Change', () => {
        it('should notify on availability change', () => {
            const callback = vi.fn();
            toolManager.onAvailabilityChange(callback);

            const tools: Tool[] = [
                { toolName: 'tool1', paramsSchema: z.object({}), desc: 'Tool 1' },
            ];
            const provider = createMockToolProvider('test-provider', tools);
            toolManager.registerProvider(provider);

            expect(callback).toHaveBeenCalled();
        });

        it('should unsubscribe from availability changes', () => {
            const callback = vi.fn();
            const unsubscribe = toolManager.onAvailabilityChange(callback);

            unsubscribe();

            const tools: Tool[] = [
                { toolName: 'tool1', paramsSchema: z.object({}), desc: 'Tool 1' },
            ];
            const provider = createMockToolProvider('test-provider', tools);
            toolManager.registerProvider(provider);

            expect(callback).not.toHaveBeenCalled();
        });
    });
});
