import { Permission, PublicState, StatefulComponent, StateType, ScriptExecutionResult, CommonTools } from './statefulComponent'
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
 * Test component demonstrating the virtual workspace concept
 * - Has a public search_box_state that can be mutated via scripts
 * - Has a private search_result state that updates via side effects
 */
class TestSearchComponent extends StatefulComponent {
    protected override publicStates: Record<string, PublicState> = {
        search_box_state: {
            type: StateType.public,
            permission: Permission.rw,
            schema: search_box_state_schema,
            sideEffectsDesc: `Any changes of this state object will automatically trigger searching action and refresh search results`,
            state: proxy<z.infer<typeof search_box_state_schema>>({
                search_pattern: ''
            })
        },
    }

    state = {
        search_result: ''
    }

    constructor() {
        super()
        subscribe(this.publicStates['search_box_state'].state, async () => {
            const mockedApiSearch = () => { return 'mocked search result' }
            console.log(`state has changed to`, this.publicStates['search_box_state'].state)
            this.state.search_result = mockedApiSearch()
        })
    }

    /**
     * Get current search result (private state)
     */
    getSearchResult(): string {
        return this.state.search_result
    }

    /**
     * Get current search pattern (public state)
     */
    getSearchPattern(): string {
        return (this.publicStates['search_box_state'].state as SearchBoxState).search_pattern
    }

    /**
     * Expose executeScript for testing purposes
     */
    async executeScriptForTest(script: string): Promise<ScriptExecutionResult> {
        return this.executeScript(script);
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

describe('StatefulComponent - Virtual Workspace Framework Demo', () => {
    let component: TestSearchComponent;
    let llm: SimulatedLLM;

    beforeEach(() => {
        component = new TestSearchComponent();
        llm = new SimulatedLLM();
    });

    describe('Basic State Management', () => {
        it('should initialize with empty search pattern', () => {
            expect(component.getSearchPattern()).toBe('');
            expect(component.getSearchResult()).toBe('');
        });

        it('should render public states as context', async () => {
            const context = await component.render();

            console.log(context)
            // New format is human-readable ASCII art, not JSON
            expect(context).toContain('VIRTUAL WORKSPACE - AVAILABLE STATES');
            expect(context).toContain('State: search_box_state');
            expect(context).toContain('PUBLIC');
            expect(context).toContain('READ_AND_WRITE');
            expect(context).toContain('search_pattern');
        });

        it('should render with script section for LLM', async () => {
            const context = await component.renderWithScriptSection();

            expect(context).toContain('VIRTUAL WORKSPACE - AVAILABLE STATES');
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

    describe('Script Execution', () => {
        it('should execute script to mutate public state', async () => {
            const script = `
search_box_state.search_pattern = "new search term";
return "State updated";
            `.trim();

            const result = await component.executeScriptForTest(script);

            expect(result.success).toBe(true);
            expect(result.message).toBe('Script executed successfully');
            expect(component.getSearchPattern()).toBe('new search term');
        });

        it('should trigger side effects when state is mutated via script', async () => {
            const script = `
search_box_state.search_pattern = "trigger side effect";
            `.trim();

            await component.executeScriptForTest(script);

            // Wait for async side effect
            await new Promise(resolve => setTimeout(resolve, 10));

            expect(component.getSearchPattern()).toBe('trigger side effect');
            expect(component.getSearchResult()).toBe('mocked search result');
        });

        it('should handle script errors gracefully', async () => {
            const script = `
throw new Error("Intentional error");
            `.trim();

            const result = await component.executeScriptForTest(script);

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

            const result = await component.executeScriptForTest(script);

            expect(result.success).toBe(true);
            expect(component.getSearchPattern()).toBe('async update');
        });
    });

    describe('End-to-End Workflow Simulation', () => {
        it('should simulate traditional agent workflow (for comparison)', async () => {
            // Traditional: Build context -> LLM tool call -> Execute -> Build context
            const context1 = await component.render();

            expect(context1).toContain('search_pattern');

            // Simulate tool call by directly mutating state
            await component.executeScriptForTest('search_box_state.search_pattern = "traditional approach";');

            // Rebuild context
            const context2 = await component.render();

            expect(context2).toContain('traditional approach');
        });

        it('should simulate virtual workspace workflow', async () => {
            // Virtual workspace: Render environment -> LLM returns script -> Execute script -> Re-render
            const context1 = await component.renderWithScriptSection();

            expect(context1).toContain('VIRTUAL WORKSPACE - AVAILABLE STATES');
            expect(context1).toContain('HOW TO INTERACT WITH STATES');
            expect(context1).toContain('EXAMPLES');

            // LLM generates script
            const script = await llm.generateScript(context1);

            // Execute script
            const result = await component.executeScriptForTest(script);

            expect(result.success).toBe(true);

            // Re-render to see updated state
            const context2 = await component.renderWithScriptSection();

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

            for (const script of scripts) {
                const result = await component.executeScriptForTest(script);

                expect(result.success).toBe(true);
                expect(component.getSearchPattern()).toBeTruthy();
            }
        });

        it('should demonstrate state-driven side effects', async () => {
            let sideEffectTriggered = false;

            // Use a getter to access the protected publicStates
            const publicState = (component as any).publicStates['search_box_state'].state;

            subscribe(publicState, () => {
                sideEffectTriggered = true;
            });

            await component.executeScriptForTest('search_box_state.search_pattern = "trigger";');

            await new Promise(resolve => setTimeout(resolve, 10));

            expect(sideEffectTriggered).toBe(true);
            expect(component.getSearchResult()).toBe('mocked search result');
        });

        it('should demonstrate separation of public and private states', async () => {
            const context = await component.render();

            // Public state should be in context
            expect(context).toContain('State: search_box_state');

            // Private state should not be in context
            expect(context).not.toContain('search_result');

            // But private state should still be accessible internally
            expect(component.getSearchResult()).toBeDefined();
        });
    });

    describe('Permission System', () => {
        it('should respect read-only permission', async () => {
            // Create a component with read-only state
            class ReadOnlyComponent extends StatefulComponent {
                protected override publicStates: Record<string, PublicState> = {
                    read_only_state: {
                        type: StateType.public,
                        permission: Permission.r,
                        schema: z.object({ value: z.string() }),
                        state: proxy({ value: 'read-only' })
                    }
                };
            }

            const roComponent = new ReadOnlyComponent();
            const context = await roComponent.render();

            expect(context).toContain('State: read_only_state');
            expect(context).toContain('READ_ONLY');
        });

        it('should respect write-only permission', async () => {
            // Create a component with write-only state
            class WriteOnlyComponent extends StatefulComponent {
                protected override publicStates: Record<string, PublicState> = {
                    write_only_state: {
                        type: StateType.public,
                        permission: Permission.w,
                        schema: z.object({ value: z.string() }),
                        state: proxy({ value: 'write-only' })
                    }
                };
            }

            const woComponent = new WriteOnlyComponent();
            const context = await woComponent.render();

            expect(context).toContain('State: write_only_state');
            expect(context).toContain('WRITE_ONLY');
        });
    });

    describe('Framework Concept Summary', () => {
        it('should document key differences from traditional frameworks', () => {
            // This test documents the conceptual differences
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
                    'Clear separation of public/private states',
                    'Permission-based access control'
                ]
            };

            expect(frameworkConcept.traditional.workflow).toBeDefined();
            expect(frameworkConcept.virtualWorkspace.workflow).toBeDefined();
        });
    });
})