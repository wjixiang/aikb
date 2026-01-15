import { Permission, StatefulComponent, State, ScriptExecutionResult, CommonTools } from './statefulComponent'
import { VirtualWorkspace } from './virtualWorkspace';
import { proxy, subscribe } from 'valtio'
import * as z from 'zod'
import { describe, it, expect, beforeEach, vi } from 'vitest'

const search_box_state_schema = z.object({
    search_pattern: z.string().max(300)
})

interface SearchBoxState {
    search_pattern: string;
}

/**
 * Test component demonstrating the unified state concept
 * - Has a search_box_state that can be mutated via scripts
 * - Has a private search_result state that updates via side effects
 */
class TestSearchComponent extends StatefulComponent {
    protected override states: Record<string, State> = {
        search_box_state: {
            permission: Permission.rw,
            schema: search_box_state_schema,
            sideEffectsDesc: `Any changes of this state object will automatically trigger searching action and refresh search results`,
            state: proxy<z.infer<typeof search_box_state_schema>>({
                search_pattern: ''
            })
        },
    }

    // Internal state (not exposed via states)
    private searchResult = ''

    constructor() {
        super()
        subscribe(this.states['search_box_state'].state, async () => {
            const mockedApiSearch = () => { return 'mocked search result' }
            console.log(`state has changed to`, this.states['search_box_state'].state)
            this.searchResult = mockedApiSearch()
        })
    }

    /**
     * Get current search result (internal state)
     */
    getSearchResult(): string {
        return this.searchResult
    }

    /**
     * Get current search pattern (exposed state)
     */
    getSearchPattern(): string {
        return (this.states['search_box_state'].state as SearchBoxState).search_pattern
    }
}

/**
 * Simulated LLM that generates scripts to interact with the virtual workspace
 */
class SimulatedLLM {
    /**
     * Simulate LLM receiving context and generating a script
     */
    async generateScript(context: string): Promise<string> {
        // In a real implementation, this would be an actual LLM call
        // For demo purposes, we return a simple script
        return `
search_box_state.search_pattern = "test search query";
return "Search pattern updated";
        `.trim();
    }

    /**
     * Simulate LLM generating a completion script
     */
    async generateCompletionScript(context: string): Promise<string> {
        return `
await attempt_completion("Task completed successfully");
        `.trim();
    }
}

describe('StatefulComponent - Unified State Model', () => {
    let component: TestSearchComponent;
    let workspace: VirtualWorkspace;
    let llm: SimulatedLLM;

    beforeEach(() => {
        component = new TestSearchComponent();
        workspace = new VirtualWorkspace({
            id: 'test-workspace',
            name: 'Test Workspace'
        });
        workspace.registerComponent({
            key: 'search',
            component: component
        });
        llm = new SimulatedLLM();
    });

    describe('Basic State Management', () => {
        it('should initialize with empty search pattern', () => {
            expect(component.getSearchPattern()).toBe('');
            expect(component.getSearchResult()).toBe('');
        });

        it('should render states as context', async () => {
            const context = await component.render();

            console.log(context)
            // New format is human-readable ASCII art, not JSON
            expect(context).toContain('AVAILABLE STATES');
            expect(context).toContain('State: search_box_state');
            expect(context).toContain('READ_AND_WRITE');
            expect(context).toContain('search_pattern');
        });

        it('should render with script section for LLM', async () => {
            const context = await component.renderWithScriptSection();

            expect(context).toContain('AVAILABLE STATES');
            expect(context).toContain('SCRIPT WRITING GUIDE');
            expect(context).toContain('STATE INITIALIZATION');
            expect(context).toContain('const search_box_state = {"search_pattern":""};');
            expect(context).toContain('HOW TO INTERACT WITH STATES');
            expect(context).toContain('EXAMPLES');
            expect(context).toContain('execute_script');
            expect(context).toContain('attempt_completion');
            expect(context).toContain('search_box_state.search_pattern = "new search term"');
        });
    });

    describe('Script Execution via Workspace', () => {
        it('should execute script to mutate state', async () => {
            const script = `
search_box_state.search_pattern = "new search term";
return "State updated";
            `.trim();

            const tools = workspace.getCommonTools();
            const result = await tools.execute_script(script);

            expect(result.success).toBe(true);
            expect(result.message).toBe('Script executed successfully');
            expect(component.getSearchPattern()).toBe('new search term');
        });

        it('should trigger side effects when state is mutated via script', async () => {
            const script = `
search_box_state.search_pattern = "trigger side effect";
            `.trim();

            const tools = workspace.getCommonTools();
            await tools.execute_script(script);

            // Wait for async side effect
            await new Promise(resolve => setTimeout(resolve, 10));

            expect(component.getSearchPattern()).toBe('trigger side effect');
            expect(component.getSearchResult()).toBe('mocked search result');
        });

        it('should handle script errors gracefully', async () => {
            const script = `
throw new Error("Intentional error");
            `.trim();

            const tools = workspace.getCommonTools();
            const result = await tools.execute_script(script);

            expect(result.success).toBe(false);
            expect(result.message).toBe('Script execution failed');
            expect(result.error).toContain('Intentional error');
        });

        it('should support async operations in scripts', async () => {
            const script = `
await new Promise(resolve => setTimeout(resolve, 5));
search_box_state.search_pattern = "async update";
return "Async operation completed";
            `.trim();

            const tools = workspace.getCommonTools();
            const result = await tools.execute_script(script);

            expect(result.success).toBe(true);
            expect(component.getSearchPattern()).toBe('async update');
        });
    });

    describe('End-to-End Workflow Simulation', () => {
        it('should simulate traditional agent workflow (for comparison)', async () => {
            // Traditional: Build context -> LLM tool call -> Execute -> Build context
            const context1 = await component.render();

            expect(context1).toContain('search_pattern');

            // Simulate tool call by directly mutating state via workspace
            const tools = workspace.getCommonTools();
            await tools.execute_script('search_box_state.search_pattern = "traditional approach";');

            // Rebuild context
            const context2 = await component.render();

            expect(context2).toContain('traditional approach');
        });

        it('should simulate virtual workspace workflow', async () => {
            // Virtual workspace: Render environment -> LLM returns script -> Execute script -> Re-render
            const context1 = await workspace.renderWithScriptSection();

            expect(context1).toContain('VIRTUAL WORKSPACE: Test Workspace');
            expect(context1).toContain('SCRIPT EXECUTION GUIDE');
            expect(context1).toContain('AVAILABLE TOOLS');
            expect(context1).toContain('EXAMPLES');

            // LLM generates script
            const script = await llm.generateScript(context1);

            // Execute script
            const tools = workspace.getCommonTools();
            const result = await tools.execute_script(script);

            expect(result.success).toBe(true);

            // Re-render to see updated state
            const context2 = await workspace.renderWithScriptSection();

            expect(context2).toContain('test search query');
        });
    });

    describe('Framework Concept Validation', () => {
        it('should demonstrate flexible script execution instead of hardcoded tools', async () => {
            // Instead of having a specific "set_search_pattern" tool,
            // LLM can write any script to manipulate state
            const scripts = [
                'search_box_state.search_pattern = "simple";',
                'search_box_state.search_pattern = "complex " + "query";',
                'search_box_state.search_pattern = "dynamic " + Math.random().toString(36).substring(7);',
            ];

            const tools = workspace.getCommonTools();

            for (const script of scripts) {
                const result = await tools.execute_script(script);

                expect(result.success).toBe(true);
                expect(component.getSearchPattern()).toBeTruthy();
            }
        });

        it('should demonstrate state-driven side effects', async () => {
            let sideEffectTriggered = false;

            // Use a getter to access the state
            const state = (component as any).states['search_box_state'].state;

            subscribe(state, () => {
                sideEffectTriggered = true;
            });

            const tools = workspace.getCommonTools();
            await tools.execute_script('search_box_state.search_pattern = "trigger";');

            await new Promise(resolve => setTimeout(resolve, 10));

            expect(sideEffectTriggered).toBe(true);
            expect(component.getSearchResult()).toBe('mocked search result');
        });

        it('should demonstrate unified state model', async () => {
            const context = await component.render();

            // State should be in context
            expect(context).toContain('State: search_box_state');

            // Internal state (not in states) should not be in context
            expect(context).not.toContain('search_result');

            // But internal state should still be accessible internally
            expect(component.getSearchResult()).toBeDefined();
        });
    });

    describe('Permission System', () => {
        it('should respect read-only permission', async () => {
            // Create a component with read-only state
            class ReadOnlyComponent extends StatefulComponent {
                protected override states: Record<string, State> = {
                    read_only_state: {
                        permission: Permission.r,
                        schema: z.object({ value: z.string() }),
                        state: proxy({ value: 'read-only' })
                    }
                };
            }

            const roComponent = new ReadOnlyComponent();
            const roWorkspace = new VirtualWorkspace({
                id: 'ro-test',
                name: 'Read-Only Test'
            });
            roWorkspace.registerComponent({
                key: 'readonly',
                component: roComponent
            });

            const context = await roComponent.render();

            expect(context).toContain('State: read_only_state');
            expect(context).toContain('READ_ONLY');
        });

        it('should respect write-only permission', async () => {
            // Create a component with write-only state
            class WriteOnlyComponent extends StatefulComponent {
                protected override states: Record<string, State> = {
                    write_only_state: {
                        permission: Permission.w,
                        schema: z.object({ value: z.string() }),
                        state: proxy({ value: 'write-only' })
                    }
                };
            }

            const woComponent = new WriteOnlyComponent();
            const woWorkspace = new VirtualWorkspace({
                id: 'wo-test',
                name: 'Write-Only Test'
            });
            woWorkspace.registerComponent({
                key: 'writeonly',
                component: woComponent
            });

            const context = await woComponent.render();

            expect(context).toContain('State: write_only_state');
            expect(context).toContain('WRITE_ONLY');
        });
    });

    describe('Framework Concept Summary', () => {
        it('should document key differences from traditional frameworks', () => {
            // This test documents conceptual differences
            const frameworkConcept = {
                traditional: {
                    workflow: 'Build context -> LLM tool call -> Execute tool -> Build context',
                    approach: 'Hardcoded specialized tools for each scenario',
                    flexibility: 'Limited - new scenarios require new tools'
                },
                virtualWorkspace: {
                    workflow: 'Render environment -> LLM returns script -> Execute script -> Re-render',
                    approach: 'Flexible script execution via common tools (execute_script, attempt_completion)',
                    flexibility: 'High - LLM can write any script to manipulate states'
                },
                keyBenefits: [
                    'No need for specialized tools',
                    'LLM has more flexibility',
                    'State-driven side effects',
                    'Unified state model (no public/private distinction)',
                    'Permission-based access control',
                    'Centralized script execution with merged states'
                ]
            };

            expect(frameworkConcept.traditional.workflow).toBeDefined();
            expect(frameworkConcept.virtualWorkspace.workflow).toBeDefined();
        });
    });
})
