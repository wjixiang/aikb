import { describe, it, expect } from 'vitest';
import { VirtualWorkspace } from '../../statefulContext/index.js';
import { DefaultToolCallConverter } from 'llm-api-client';
import { ToolManager } from '../../tools/index.js';
import { ComponentToolProvider } from '../../tools/providers/ComponentToolProvider.js';
import { ComponentRegistry } from '../../../components/ComponentRegistry.js';
import { GlobalToolProvider } from '../../tools/providers/GlobalToolProvider.js';
import { z } from 'zod';

function createTestWorkspace(
  config: Partial<{ id: string; name: string }> = {},
): VirtualWorkspace {
  const toolManager = new ToolManager();
  const componentRegistry = new ComponentRegistry();
  const globalToolProvider = new GlobalToolProvider();

  return new VirtualWorkspace(
    toolManager,
    componentRegistry,
    globalToolProvider,
    config,
  );
}

describe('Agent Tool Coordination - Unit Tests', () => {
  describe('Workspace Tool Conversion', () => {
    it('should convert workspace tools to OpenAI format', () => {
      const toolManager = new ToolManager();
      const componentRegistry = new ComponentRegistry();
      const globalToolProvider = new GlobalToolProvider();
      const workspace = new VirtualWorkspace(
        toolManager,
        componentRegistry,
        globalToolProvider,
        {
          id: 'test-workspace',
          name: 'Test Workspace',
        },
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
        toolSet: new Map([['search_database', mockTool]]),
        render: async () => ({
          render: () => '',
          renderWithWidth: () => ({ content: '', width: 0, height: 0 }),
          addChild: () => {},
        }),
        renderToolSection: () => ({
          render: () => '',
          renderWithWidth: () => ({ content: '', width: 0, height: 0 }),
          addChild: () => {},
        }),
        handleToolCall: async () => ({ success: true }),
      };

      const componentProvider = new ComponentToolProvider(
        'search-component',
        mockComponent as any,
      );
      toolManager.registerProvider(componentProvider);

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
      const toolManager = new ToolManager();
      const componentRegistry = new ComponentRegistry();
      const globalToolProvider = new GlobalToolProvider();
      const workspace = new VirtualWorkspace(
        toolManager,
        componentRegistry,
        globalToolProvider,
        {
          id: 'multi-workspace',
          name: 'Multi Tool Workspace',
        },
      );

      const component1 = {
        toolSet: new Map([
          [
            'tool1',
            {
              toolName: 'tool1',
              desc: 'First tool',
              paramsSchema: z.object({ param1: z.string() }),
            },
          ],
        ]),
        render: async () => ({
          render: () => '',
          renderWithWidth: () => ({ content: '', width: 0, height: 0 }),
          addChild: () => {},
        }),
        renderToolSection: () => ({
          render: () => '',
          renderWithWidth: () => ({ content: '', width: 0, height: 0 }),
          addChild: () => {},
        }),
        handleToolCall: async () => ({ success: true }),
      };

      const component2 = {
        toolSet: new Map([
          [
            'tool2',
            {
              toolName: 'tool2',
              desc: 'Second tool',
              paramsSchema: z.object({ param2: z.number() }),
            },
          ],
        ]),
        render: async () => ({
          render: () => '',
          renderWithWidth: () => ({ content: '', width: 0, height: 0 }),
          addChild: () => {},
        }),
        renderToolSection: () => ({
          render: () => '',
          renderWithWidth: () => ({ content: '', width: 0, height: 0 }),
          addChild: () => {},
        }),
        handleToolCall: async () => ({ success: true }),
      };

      const componentProvider1 = new ComponentToolProvider(
        'component1',
        component1 as any,
      );
      const componentProvider2 = new ComponentToolProvider(
        'component2',
        component2 as any,
      );
      toolManager.registerProvider(componentProvider1);
      toolManager.registerProvider(componentProvider2);

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
