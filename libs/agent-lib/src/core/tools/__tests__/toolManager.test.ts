import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ToolManager } from '../ToolManager.js';
import type { Tool } from '../../../components/core/types.js';
import { z } from 'zod';
import type { HookModule } from '../../hooks/HookModule.js';

describe('ToolManager', () => {
  let toolManager: ToolManager;
  let mockHookModule: HookModule;

  beforeEach(() => {
    mockHookModule = {
      executeHooks: vi.fn().mockResolvedValue(undefined),
      registerHook: vi.fn(),
      unregisterHook: vi.fn(),
      getRegisteredHooks: vi.fn().mockReturnValue([]),
    } as unknown as HookModule;

    toolManager = new ToolManager(mockHookModule, 'test-instance-id');
  });

  describe('Tool Registration', () => {
    it('should register a tool', () => {
      toolManager.registerTool({
        tool: { toolName: 'tool1', paramsSchema: z.object({}), desc: 'Tool 1' },
        handler: vi.fn(),
      });

      expect(toolManager.hasTool('tool1')).toBe(true);
    });

    it('should unregister a tool', () => {
      toolManager.registerTool({
        tool: { toolName: 'tool1', paramsSchema: z.object({}), desc: 'Tool 1' },
        handler: vi.fn(),
      });

      const result = toolManager.unregisterTool('tool1');
      expect(result).toBe(true);
      expect(toolManager.hasTool('tool1')).toBe(false);
    });

    it('should return false when unregistering nonexistent tool', () => {
      expect(toolManager.unregisterTool('nonexistent')).toBe(false);
    });
  });

  describe('Tool Management', () => {
    it('should get all registered tools', () => {
      toolManager.registerTool({
        tool: { toolName: 'tool1', paramsSchema: z.object({}), desc: 'Tool 1' },
        handler: vi.fn(),
      });
      toolManager.registerTool({
        tool: { toolName: 'tool2', paramsSchema: z.object({}), desc: 'Tool 2' },
        handler: vi.fn(),
      });

      const allTools = toolManager.getAllTools();
      expect(allTools.length).toBe(2);
      expect(allTools.find(t => t.tool.toolName === 'tool1')).toBeDefined();
    });

    it('should get available tools', () => {
      toolManager.registerTool({
        tool: { toolName: 'tool1', paramsSchema: z.object({}), desc: 'Tool 1' },
        handler: vi.fn(),
      });

      const availableTools = toolManager.getAvailableTools();
      expect(availableTools.length).toBe(1);
      expect(availableTools[0].toolName).toBe('tool1');
    });

    it('should get tool by name', () => {
      toolManager.registerTool({
        tool: { toolName: 'tool1', paramsSchema: z.object({}), desc: 'Tool 1' },
        handler: vi.fn(),
      });

      const tool = toolManager.getTool('tool1');
      expect(tool).toBeDefined();
      expect(tool?.tool.toolName).toBe('tool1');
    });

    it('should return undefined for nonexistent tool', () => {
      expect(toolManager.getTool('nonexistent')).toBeUndefined();
    });
  });

  describe('Tool Execution', () => {
    it('should execute a tool', async () => {
      const handler = vi.fn().mockResolvedValue({ result: 'success' });
      toolManager.registerTool({
        tool: { toolName: 'tool1', paramsSchema: z.object({}), desc: 'Tool 1' },
        handler,
      });

      const result = await toolManager.executeTool('tool1', { param: 'value' });

      expect(handler).toHaveBeenCalledWith({ param: 'value' });
      expect(result).toEqual({ result: 'success' });
    });

    it('should throw error for nonexistent tool', async () => {
      await expect(toolManager.executeTool('nonexistent', {}))
        .rejects.toThrow('not found');
    });
  });

  describe('Tool Source', () => {
    it('should get tool source info for global tool', () => {
      toolManager.registerTool({
        tool: { toolName: 'global_tool', paramsSchema: z.object({}), desc: 'Global' },
        handler: vi.fn(),
      });

      const source = toolManager.getToolSource('global_tool');
      expect(source).toBeDefined();
      expect(source?.componentKey).toBeUndefined();
    });

    it('should get tool source info for component tool', () => {
      toolManager.registerTool({
        tool: { toolName: 'comp_tool', paramsSchema: z.object({}), desc: 'Component' },
        handler: vi.fn(),
        componentKey: 'my-component',
      });

      const source = toolManager.getToolSource('comp_tool');
      expect(source).toBeDefined();
      expect(source?.componentKey).toBe('my-component');
    });

    it('should return null for nonexistent tool', () => {
      const source = toolManager.getToolSource('nonexistent');
      expect(source).toBeNull();
    });
  });

  describe('Hooks', () => {
    it('should fire TOOL_BEFORE_EXECUTE and TOOL_AFTER_EXECUTE hooks', async () => {
      const handler = vi.fn().mockResolvedValue('ok');
      toolManager.registerTool({
        tool: { toolName: 'tool1', paramsSchema: z.object({}), desc: 'Tool 1' },
        handler,
      });

      await toolManager.executeTool('tool1', {});

      expect(mockHookModule.executeHooks).toHaveBeenCalledTimes(2);
    });
  });
});
