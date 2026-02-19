import { describe, it, expect } from 'vitest';
import { VirtualWorkspace } from '../../statefulContext/index.js';
import { DefaultToolCallConverter } from '../../api-client/ToolCallConvert';
import { z } from 'zod';

describe('Agent Tool Coordination - Unit Tests', () => {
    describe('Workspace Tool Conversion', () => {
        it('should convert workspace tools to OpenAI format', () => {
            // Create workspace
            const workspace = new VirtualWorkspace({
                id: 'test-workspace',
                name: 'Test Workspace',
            });

            // Create a mock tool component with proper structure
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

            workspace.registerComponent({
                key: 'search-component',
                component: mockComponent as any,
                priority: 1,
            });

            // Get tools from workspace
            const allTools = workspace.getAllTools();
            expect(allTools).toHaveLength(1);

            // Convert to OpenAI format
            const converter = new DefaultToolCallConverter();
            const openaiTools = converter.convertTools(allTools.map(t => t.tool));

            // Verify conversion
            expect(openaiTools).toHaveLength(1);
            expect(openaiTools[0]).toMatchObject({
                type: 'function',
                function: {
                    name: 'search_database',
                    description: 'Search the medical database',
                },
            });

            if (openaiTools[0].type === 'function') {
                expect(openaiTools[0].function.parameters).toHaveProperty('type', 'object');
                expect(openaiTools[0].function.parameters).toHaveProperty('properties');
            }
        });

        it('should handle multiple tools from multiple components', () => {
            const workspace = new VirtualWorkspace({
                id: 'multi-workspace',
                name: 'Multi Tool Workspace',
            });

            // Component 1
            const component1 = {
                toolSet: new Map([
                    ['tool1', {
                        toolName: 'tool1',
                        desc: 'First tool',
                        paramsSchema: z.object({ param1: z.string() }),
                    }],
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

            // Component 2
            const component2 = {
                toolSet: new Map([
                    ['tool2', {
                        toolName: 'tool2',
                        desc: 'Second tool',
                        paramsSchema: z.object({ param2: z.number() }),
                    }],
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

            workspace.registerComponent({
                key: 'component1',
                component: component1 as any,
                priority: 1,
            });

            workspace.registerComponent({
                key: 'component2',
                component: component2 as any,
                priority: 2,
            });

            // Get and convert tools
            const allTools = workspace.getAllTools();
            expect(allTools).toHaveLength(2);

            const converter = new DefaultToolCallConverter();
            const openaiTools = converter.convertTools(allTools.map(t => t.tool));

            expect(openaiTools).toHaveLength(2);
            const functionTools = openaiTools.filter(t => t.type === 'function');
            expect(functionTools.map(t => t.function.name)).toContain('tool1');
            expect(functionTools.map(t => t.function.name)).toContain('tool2');
        });

        it('should handle empty workspace', () => {
            const workspace = new VirtualWorkspace({
                id: 'empty-workspace',
                name: 'Empty Workspace',
            });

            const allTools = workspace.getAllTools();
            expect(allTools).toHaveLength(0);

            const converter = new DefaultToolCallConverter();
            const openaiTools = converter.convertTools(allTools.map(t => t.tool));

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

            // Verify structure
            expect(openaiTool).toHaveProperty('type', 'function');
            expect(openaiTool).toHaveProperty('function');
            if (openaiTool.type === 'function') {
                expect(openaiTool.function).toHaveProperty('name', 'calculate');
                expect(openaiTool.function).toHaveProperty('description', 'Perform mathematical calculations');
                expect(openaiTool.function).toHaveProperty('parameters');

                // Verify parameters structure
                const params = openaiTool.function.parameters;
                expect(params).toHaveProperty('type', 'object');
                expect(params).toHaveProperty('properties');
                expect(params.properties).toHaveProperty('expression');
                expect(params.properties).toHaveProperty('precision');
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
                expect(openaiTool.function.parameters.properties).toHaveProperty('simple');
                expect(openaiTool.function.parameters.properties).toHaveProperty('nested');
                expect(openaiTool.function.parameters.properties).toHaveProperty('array');
                expect(openaiTool.function.parameters.properties).toHaveProperty('optional');
            }
        });
    });
});
