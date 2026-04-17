import { describe, it, expect } from 'vitest';
import { VirtualWorkspace } from '../../statefulContext/index.js';
import { DefaultToolCallConverter } from 'llm-api-client';
import { ToolManager } from '../../tools/index.js';
import { z } from 'zod';

function createTestWorkspace(
  config: Partial<{ id: string; name: string }> = {},
): VirtualWorkspace {
  const toolManager = new ToolManager(
    {
      executeHooks: async () => {},
      registerHook: () => {},
      unregisterHook: () => {},
      getRegisteredHooks: () => [],
    } as any,
    'test-instance-id',
  );

  return new VirtualWorkspace(toolManager, config);
}

describe('Agent Tool Coordination - Unit Tests', () => {
  describe('Workspace Tool Conversion', () => {
    it('should convert workspace tools to OpenAI format', () => {
      const toolManager = new ToolManager(
        {
          executeHooks: async () => {},
          registerHook: () => {},
          unregisterHook: () => {},
          getRegisteredHooks: () => [],
        } as any,
        'test-instance-id',
      );

      const mockTool = {
        toolName: 'search_database',
        desc: 'Search the medical database',
        paramsSchema: z.object({
          query: z.string().describe('Search query'),
          limit: z.number().optional().describe('Result limit'),
        }),
      };

      const mockComponent = {
        componentId: 'search-component',
        toolSet: new Map([['search_database', mockTool]]),
        renderImply: async () => [],
        handleToolCall: async () => ({ success: true }),
      };

      toolManager.registerTool({
        tool: mockTool,
        handler: (params) => mockComponent.handleToolCall(mockTool.toolName, params),
        componentKey: 'search-component',
      });

      const workspace = new VirtualWorkspace(toolManager, {
        id: 'test-workspace',
        name: 'Test Workspace',
      }, [mockComponent as any]);

      const allTools = workspace.getAllTools();
      const componentTools = allTools.filter((t) => t.source === 'component');
      expect(componentTools).toHaveLength(1);

      const converter = new DefaultToolCallConverter();
      const openaiTools = converter.convertTools(
        componentTools.map((t) => t.tool),
      );

      expect(openaiTools).toHaveLength(1);
      expect(openaiTools[0]).toMatchObject({
        type: 'function',
        function: {
          name: 'search_database',
          description: 'Search the medical database',
        },
      });

      if (openaiTools[0].type === 'function') {
        const params = openaiTools[0].function.parameters;
        expect(params).toHaveProperty('type', 'object');
        expect(params).toHaveProperty('properties');
      }
    });

    it('should handle multiple tools from multiple components', () => {
      const toolManager = new ToolManager(
        {
          executeHooks: async () => {},
          registerHook: () => {},
          unregisterHook: () => {},
          getRegisteredHooks: () => [],
        } as any,
        'test-instance-id',
      );

      const mockTool1 = {
        toolName: 'tool1',
        desc: 'First tool',
        paramsSchema: z.object({ param1: z.string() }),
      };

      const mockTool2 = {
        toolName: 'tool2',
        desc: 'Second tool',
        paramsSchema: z.object({ param2: z.number() }),
      };

      const component1 = {
        componentId: 'component1',
        toolSet: new Map([['tool1', mockTool1]]),
        renderImply: async () => [],
        handleToolCall: async () => ({ success: true }),
      };

      const component2 = {
        componentId: 'component2',
        toolSet: new Map([['tool2', mockTool2]]),
        renderImply: async () => [],
        handleToolCall: async () => ({ success: true }),
      };

      toolManager.registerTool({
        tool: mockTool1,
        handler: (params) => component1.handleToolCall(mockTool1.toolName, params),
        componentKey: 'component1',
      });
      toolManager.registerTool({
        tool: mockTool2,
        handler: (params) => component2.handleToolCall(mockTool2.toolName, params),
        componentKey: 'component2',
      });

      const workspace = new VirtualWorkspace(toolManager, {
        id: 'multi-workspace',
        name: 'Multi Tool Workspace',
      });

      const allTools = workspace.getAllTools();
      const componentTools = allTools.filter((t) => t.source === 'component');
      expect(componentTools).toHaveLength(2);

      const converter = new DefaultToolCallConverter();
      const openaiTools = converter.convertTools(
        componentTools.map((t) => t.tool),
      );

      expect(openaiTools).toHaveLength(2);
      const functionTools = openaiTools.filter((t) => t.type === 'function');
      expect(functionTools.map((t) => t.function.name)).toContain('tool1');
      expect(functionTools.map((t) => t.function.name)).toContain('tool2');
    });

    it('should handle empty workspace', () => {
      const workspace = createTestWorkspace({
        id: 'empty-workspace',
        name: 'Empty Workspace',
      });

      const allTools = workspace.getAllTools();
      const componentTools = allTools.filter((t) => t.source === 'component');
      expect(componentTools).toHaveLength(0);

      const converter = new DefaultToolCallConverter();
      const openaiTools = converter.convertTools(
        componentTools.map((t) => t.tool),
      );

      expect(openaiTools).toHaveLength(0);
    });
  });

  describe('Tool Conversion Format', () => {
    it('should produce valid OpenAI tool format', () => {
      const mockTool = {
        toolName: 'calculate',
        desc: 'Perform mathematical calculations',
        paramsSchema: z.object({
          expression: z.string().describe('Mathematical expression'),
          precision: z.number().optional().describe('Decimal precision'),
        }),
      };

      const converter = new DefaultToolCallConverter();
      const openaiTool = converter.convertTool(mockTool);

      expect(openaiTool).toHaveProperty('type', 'function');
      expect(openaiTool).toHaveProperty('function');
      if (openaiTool.type === 'function') {
        expect(openaiTool.function).toHaveProperty('name', 'calculate');
        expect(openaiTool.function).toHaveProperty(
          'description',
          'Perform mathematical calculations',
        );
        expect(openaiTool.function).toHaveProperty('parameters');

        const params = openaiTool.function.parameters;
        expect(params).toHaveProperty('type', 'object');
        expect(params?.properties).toHaveProperty('expression');
        expect(params?.properties).toHaveProperty('precision');
      }
    });

    it('should handle complex nested schemas', () => {
      const mockTool = {
        toolName: 'complex_tool',
        desc: 'A tool with complex parameters',
        paramsSchema: z.object({
          simple: z.string(),
          nested: z.object({
            field1: z.string(),
            field2: z.number(),
          }),
          array: z.array(z.string()),
          optional: z.string().optional(),
        }),
      };

      const converter = new DefaultToolCallConverter();
      const openaiTool = converter.convertTool(mockTool);

      if (openaiTool.type === 'function') {
        const params = openaiTool.function.parameters;
        expect(params?.properties).toHaveProperty('simple');
        expect(params?.properties).toHaveProperty('nested');
        expect(params?.properties).toHaveProperty('array');
        expect(params?.properties).toHaveProperty('optional');
      }
    });
  });
});
