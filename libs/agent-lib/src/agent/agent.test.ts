import { VirtualWorkspace } from "@/libs/statefulContext/src";
import { Agent, defaultAgentConfig, defaultApiConfig } from "./agent";
import { KmsWorkspace } from "./workspaces/KmsWorkspace";
import { ToolComponent, Tool } from "statefulContext";
import { z } from "zod";
import { tdiv } from "statefulContext";

const testWorkspace = new VirtualWorkspace({
    id: 'id',
    name: 'name'
})

/**
 * Mock ToolComponent for testing
 */
class MockToolComponent extends ToolComponent {
    toolSet = new Map<string, Tool>([
        ['mockTool', {
            toolName: 'mockTool',
            desc: 'A mock tool for testing',
            paramsSchema: z.object({ param: z.string().describe('A test parameter') })
        }]
    ]);

    private testData: string = 'test data';

    renderImply = async () => {
        return [
            new tdiv({
                content: '## Mock Component',
                styles: { width: 80, showBorder: false }
            }),
            new tdiv({
                content: this.testData,
                styles: { width: 80, showBorder: false }
            })
        ];
    };

    handleToolCall = async (toolName: string, params: any): Promise<void> => {
        if (toolName === 'mockTool') {
            this.testData = params.param || 'default';
        }
    };

    getTestData(): string {
        return this.testData;
    }

    setTestData(data: string): void {
        this.testData = data;
    }
}

describe(Agent, () => {
    let agent: Agent

    it('should get proper prompt', async () => {

    })

    it('should handle tool calling', async () => {

    })

    describe('testComponent', () => {
        let mockWorkspace: VirtualWorkspace
        let mockComponent: MockToolComponent

        beforeEach(() => {
            mockWorkspace = new VirtualWorkspace({
                id: 'test-workspace',
                name: 'Test Workspace'
            })
            mockComponent = new MockToolComponent()
            mockWorkspace.registerComponent({
                key: 'mock_component',
                component: mockComponent,
                priority: 0
            })
        })

        it('should initialize with workspace components', () => {
            agent = new Agent(defaultAgentConfig, defaultApiConfig, mockWorkspace)

            // Verify workspace has components registered
            const componentKeys = mockWorkspace.getComponentKeys()
            expect(componentKeys).toContain('mock_component')
            expect(componentKeys.length).toBe(1)
        })

        it('should access registered component', () => {
            agent = new Agent(defaultAgentConfig, defaultApiConfig, mockWorkspace)

            const component = mockWorkspace.getComponent('mock_component')
            expect(component).toBeDefined()
            expect(component).toBeInstanceOf(ToolComponent)
            expect(component).toBeInstanceOf(MockToolComponent)
        })

        it('should render workspace context', async () => {
            agent = new Agent(defaultAgentConfig, defaultApiConfig, mockWorkspace)

            const workspaceContext = await mockWorkspace.render()
            expect(workspaceContext).toBeDefined()
            expect(typeof workspaceContext).toBe('string')
            expect(workspaceContext.length).toBeGreaterThan(0)
            expect(workspaceContext).toContain('Test Workspace')
        })

        it('should get test data from mock component', async () => {
            agent = new Agent(defaultAgentConfig, defaultApiConfig, mockWorkspace)

            const component = mockWorkspace.getComponent('mock_component') as MockToolComponent
            expect(component).toBeDefined()

            const testData = component.getTestData()
            expect(testData).toBe('test data')
        })

        it('should set test data on mock component', async () => {
            agent = new Agent(defaultAgentConfig, defaultApiConfig, mockWorkspace)

            const component = mockWorkspace.getComponent('mock_component') as MockToolComponent
            expect(component).toBeDefined()

            component.setTestData('new test data')
            expect(component.getTestData()).toBe('new test data')
        })

        it('should render mock component', async () => {
            agent = new Agent(defaultAgentConfig, defaultApiConfig, mockWorkspace)

            const component = mockWorkspace.getComponent('mock_component') as MockToolComponent
            expect(component).toBeDefined()

            const rendered = await component.render()
            expect(rendered).toBeDefined()
            expect(typeof rendered).toBe('object')
        })

        it('should get component toolSet', async () => {
            agent = new Agent(defaultAgentConfig, defaultApiConfig, mockWorkspace)

            const component = mockWorkspace.getComponent('mock_component') as MockToolComponent
            expect(component).toBeDefined()

            const toolSet = component.toolSet
            expect(toolSet).toBeDefined()
            expect(toolSet.size).toBe(1)
            expect(toolSet.has('mockTool')).toBe(true)

            const tool = toolSet.get('mockTool')
            expect(tool).toBeDefined()
            expect(tool?.toolName).toBe('mockTool')
            expect(tool?.desc).toBe('A mock tool for testing')
        })

        it.only('should handle tool call through workspace', async () => {
            agent = new Agent(defaultAgentConfig, defaultApiConfig, mockWorkspace)

            const component = mockWorkspace.getComponent('mock_component') as MockToolComponent
            expect(component).toBeDefined()

            // Initial test data
            expect(component.getTestData()).toBe('test data')

            // Handle tool call
            const result = await mockWorkspace.handleToolCall('mockTool', { param: 'updated data' })
            expect(result).toBeDefined()

            // Verify test data was updated
            expect(component.getTestData()).toBe('updated data')
        })

        it('should render tool box', () => {
            agent = new Agent(defaultAgentConfig, defaultApiConfig, mockWorkspace)

            const toolBox = mockWorkspace.renderToolBox()
            expect(toolBox).toBeDefined()
        })

        it('should render all components', async () => {
            agent = new Agent(defaultAgentConfig, defaultApiConfig, mockWorkspace)

            const componentKeys = mockWorkspace.getComponentKeys()

            for (const key of componentKeys) {
                const component = mockWorkspace.getComponent(key)
                expect(component).toBeDefined()

                const rendered = await component!.render()
                expect(rendered).toBeDefined()
                expect(typeof rendered).toBe('object')
            }
        })

        it('should handle unknown tool call gracefully', async () => {
            agent = new Agent(defaultAgentConfig, defaultApiConfig, mockWorkspace)

            const result = await mockWorkspace.handleToolCall('unknown_tool', {})
            expect(result).toBeDefined()
        })

        it('should unregister component', () => {
            agent = new Agent(defaultAgentConfig, defaultApiConfig, mockWorkspace)

            // Verify component is registered
            expect(mockWorkspace.getComponentKeys()).toContain('mock_component')

            // Unregister component
            const unregistered = mockWorkspace.unregisterComponent('mock_component')
            expect(unregistered).toBe(true)

            // Verify component is no longer registered
            expect(mockWorkspace.getComponentKeys()).not.toContain('mock_component')
            expect(mockWorkspace.getComponent('mock_component')).toBeUndefined()
        })

        it('should handle multiple mock components', async () => {
            agent = new Agent(defaultAgentConfig, defaultApiConfig, mockWorkspace)

            // Add second mock component
            const mockComponent2 = new MockToolComponent()
            mockWorkspace.registerComponent({
                key: 'mock_component_2',
                component: mockComponent2,
                priority: 1
            })

            // Verify both components are registered
            const componentKeys = mockWorkspace.getComponentKeys()
            expect(componentKeys).toContain('mock_component')
            expect(componentKeys).toContain('mock_component_2')
            expect(componentKeys.length).toBe(2)

            // Verify both components can be accessed
            const comp1 = mockWorkspace.getComponent('mock_component') as MockToolComponent
            const comp2 = mockWorkspace.getComponent('mock_component_2') as MockToolComponent
            expect(comp1).toBeDefined()
            expect(comp2).toBeDefined()

            // Verify both have independent state
            comp1.setTestData('data 1')
            comp2.setTestData('data 2')
            expect(comp1.getTestData()).toBe('data 1')
            expect(comp2.getTestData()).toBe('data 2')
        })
    })
})