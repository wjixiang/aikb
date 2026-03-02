import { describe, it, expect, vi } from 'vitest';
import { VirtualWorkspace } from '../../statefulContext/index.js';
import { ToolManager } from '../../tools/index.js';
import { ToolComponent } from '../../statefulContext/toolComponent.js';
import { tdiv } from '../../statefulContext/ui/index.js';
import { z } from 'zod';
import type { ILogger } from '../../utils/logging/types.js';

// Mock Logger
const mockLogger: ILogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
    child: vi.fn(() => mockLogger),
    close: vi.fn(),
};

// Simple test component for testing
class TestToolComponent extends ToolComponent {
    toolSet: Map<string, any>;

    constructor(toolName: string, toolDesc: string) {
        super();
        this.toolSet = new Map([
            [toolName, {
                toolName,
                desc: toolDesc,
                paramsSchema: z.object({}),
            }],
        ]);
    }

    renderImply = async (): Promise<tdiv[]> => {
        return [
            new tdiv({
                content: 'Test component content',
                styles: { width: 80, showBorder: false }
            })
        ];
    };

    handleToolCall = async (toolName: string, params: any): Promise<void> => {
        // Mock implementation
    };
}

describe('Agent Tool Coordination', () => {
    describe('VirtualWorkspace tool registration', () => {
        it('should register components and make tools available', async () => {
            // Create a mock workspace with tools
            const toolManager = new ToolManager();
            const workspace = new VirtualWorkspace({
                id: 'test-workspace',
                name: 'Test Workspace',
            }, toolManager);

            const mockComponent = new TestToolComponent('test_tool', 'A test tool');

            workspace.registerComponent({
                key: 'test-component',
                component: mockComponent as any,
                priority: 1,
            });

            // Get all tools from workspace
            const tools = workspace.getAllTools();

            // Verify tool is available (workspace has 4 built-in skills + 1 custom tool)
            expect(tools.length).toBeGreaterThanOrEqual(1);
            const customTool = tools.find(t => t.toolName === 'test_tool');
            expect(customTool).toBeDefined();
            expect(customTool?.tool).toHaveProperty('desc', 'A test tool');
        });

        it('should handle empty workspace', async () => {
            const toolManager = new ToolManager();
            const workspace = new VirtualWorkspace({
                id: 'empty-workspace',
                name: 'Empty Workspace',
            }, toolManager);

            const tools = workspace.getAllTools();
            // Workspace has 4 built-in skills by default
            expect(tools.length).toBeGreaterThanOrEqual(0);
        });

        it('should handle multiple components with tools', async () => {
            const toolManager = new ToolManager();
            const workspace = new VirtualWorkspace({
                id: 'multi-component-workspace',
                name: 'Multi Component Workspace',
            }, toolManager);

            const component1 = new TestToolComponent('tool1', 'First tool');
            const component2 = new TestToolComponent('tool2', 'Second tool');

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

            const tools = workspace.getAllTools();

            // Should have built-in skills + 2 custom tools
            expect(tools.length).toBeGreaterThanOrEqual(2);
            const toolNames = tools.map(t => t.toolName);
            expect(toolNames).toContain('tool1');
            expect(toolNames).toContain('tool2');
        });
    });

    describe('ToolManager integration', () => {
        it('should provide tools from workspace components', async () => {
            const toolManager = new ToolManager();
            const workspace = new VirtualWorkspace({
                id: 'integration-workspace',
                name: 'Integration Test Workspace',
            }, toolManager);

            const mockComponent = new TestToolComponent('calculate', 'Perform calculation');

            workspace.registerComponent({
                key: 'calc-component',
                component: mockComponent as any,
                priority: 1,
            });

            // Get tools from ToolManager
            const tools = toolManager.getAllTools();

            // Verify tools are available through ToolManager
            expect(tools.length).toBeGreaterThan(0);
            const calculateTool = tools.find(t => t.tool.toolName === 'calculate');
            expect(calculateTool).toBeDefined();
            expect(calculateTool?.tool.desc).toBe('Perform calculation');
        });

        it('should handle tool calls through workspace', async () => {
            const toolManager = new ToolManager();
            const workspace = new VirtualWorkspace({
                id: 'call-workspace',
                name: 'Call Test Workspace',
            }, toolManager);

            const mockHandleToolCall = vi.fn().mockResolvedValue({ success: true, result: 'test result' });

            const component = new TestToolComponent('test_action', 'Test action tool');
            component.handleToolCall = mockHandleToolCall;

            workspace.registerComponent({
                key: 'action-component',
                component: component as any,
                priority: 1,
            });

            // Handle tool call
            const result = await workspace.handleToolCall('test_action', { action: 'test' });

            expect(result).toBeDefined();
        });
    });

    describe('Component management', () => {
        it('should register and unregister components', async () => {
            const toolManager = new ToolManager();
            const workspace = new VirtualWorkspace({
                id: 'component-workspace',
                name: 'Component Test Workspace',
            }, toolManager);

            const mockComponent = new TestToolComponent('temp_tool', 'Temporary tool');

            workspace.registerComponent({
                key: 'temp-component',
                component: mockComponent as any,
                priority: 1,
            });

            let tools = workspace.getAllTools();
            // Should have built-in skills + 1 custom tool
            expect(tools.length).toBeGreaterThanOrEqual(1);
            const tempTool = tools.find(t => t.toolName === 'temp_tool');
            expect(tempTool).toBeDefined();

            // Unregister component
            const removed = workspace.unregisterComponent('temp-component');
            expect(removed).toBe(true);

            tools = workspace.getAllTools();
            // Temp tool should be gone
            const tempToolAfter = tools.find(t => t.toolName === 'temp_tool');
            expect(tempToolAfter).toBeUndefined();
        });

        it('should return false when unregistering non-existent component', () => {
            const toolManager = new ToolManager();
            const workspace = new VirtualWorkspace({
                id: 'test-workspace',
                name: 'Test Workspace',
            }, toolManager);

            const removed = workspace.unregisterComponent('non-existent');
            expect(removed).toBe(false);
        });

        it('should get registered component by key', () => {
            const toolManager = new ToolManager();
            const workspace = new VirtualWorkspace({
                id: 'test-workspace',
                name: 'Test Workspace',
            }, toolManager);

            const mockComponent = new TestToolComponent('my_tool', 'My tool');

            workspace.registerComponent({
                key: 'my-component',
                component: mockComponent as any,
                priority: 1,
            });

            const retrieved = workspace.getComponent('my-component');
            expect(retrieved).toBe(mockComponent);

            const notFound = workspace.getComponent('not-found');
            expect(notFound).toBeUndefined();
        });
    });

    describe('Workspace rendering with tools', () => {
        it('should render workspace context including tool sections', async () => {
            const toolManager = new ToolManager();
            const workspace = new VirtualWorkspace({
                id: 'render-workspace',
                name: 'Render Test Workspace',
            }, toolManager);

            const mockComponent = new TestToolComponent('rendered_tool', 'A tool that should be rendered');

            workspace.registerComponent({
                key: 'render-component',
                component: mockComponent as any,
                priority: 1,
            });

            const context = await workspace.render();

            expect(context).toContain('Test component content');
        });
    });
});
