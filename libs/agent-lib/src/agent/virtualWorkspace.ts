import { StatefulComponent, State, ScriptExecutionResult, CommonTools, Permission } from './statefulComponent';
import { SecurityConfig, SecureExecutionContext, createSecurityConfig } from './scriptSecurity';

/**
 * Configuration options for VirtualWorkspace
 */
export interface VirtualWorkspaceConfig {
    /**
     * Unique identifier for this workspace
     */
    id: string;
    /**
     * Human-readable name for this workspace
     */
    name: string;
    /**
     * Description of the workspace's purpose
     */
    description?: string;
    /**
     * Security configuration for script execution
     */
    securityConfig?: SecurityConfig;
}

/**
 * Component registration in the workspace
 */
export interface ComponentRegistration {
    /**
     * Unique key for accessing this component
     */
    key: string;
    /**
     * The stateful component instance
     */
    component: StatefulComponent;
    /**
     * Optional priority for rendering (lower = earlier)
     */
    priority?: number;
}

/**
 * Result of script execution with workspace context
 */
export interface WorkspaceScriptExecutionResult extends ScriptExecutionResult {
    /**
     * Execution metadata
     */
    metadata?: {
        executionTime: number;
        componentCount: number;
        stateCount: number;
    };
}

/**
 * Callback for task completion
 */
export type CompletionCallback = (result: string) => Promise<void>;

/**
 * Script Runtime - executes LLM output scripts against workspace components
 * Merges all states from all components and executes scripts centrally
 */
export class ScriptRuntime {
    private components: Map<string, StatefulComponent>;
    private completionCallback?: CompletionCallback;
    private securityConfig: SecurityConfig;

    constructor(components: Map<string, StatefulComponent>, securityConfig: SecurityConfig = {}) {
        this.components = components;
        this.securityConfig = securityConfig;
    }

    /**
     * Set the completion callback
     */
    setCompletionCallback(callback: CompletionCallback): void {
        this.completionCallback = callback;
    }

    /**
     * Merge all states from all components
     * Returns a map of state name to state object
     */
    private mergeStates(): Map<string, { state: any, permission: Permission, componentKey: string }> {
        const merged = new Map<string, { state: any, permission: Permission, componentKey: string }>();

        for (const [componentKey, component] of this.components.entries()) {
            const states = component.getStates();
            for (const [stateName, state] of Object.entries(states)) {
                // Check if state name conflicts
                if (merged.has(stateName)) {
                    console.warn(`[ScriptRuntime] State name conflict: '${stateName}' exists in multiple components. Using value from component '${componentKey}'.`);
                }
                merged.set(stateName, {
                    state: state.state,
                    permission: state.permission,
                    componentKey
                });
            }
        }

        return merged;
    }

    /**
     * Merge all utility functions from all components
     */
    private mergeUtilities(): Record<string, Function> {
        const merged: Record<string, Function> = {};

        for (const component of this.components.values()) {
            const utilities = component.getScriptUtilities();
            for (const [utilName, utilFunc] of Object.entries(utilities)) {
                merged[utilName] = utilFunc;
            }
        }

        return merged;
    }

    /**
     * Execute a script with merged states from all components
     */
    async execute(script: string): Promise<WorkspaceScriptExecutionResult> {
        const config = createSecurityConfig(this.securityConfig);
        const securityContext = new SecureExecutionContext(config);

        try {
            // Step 1: Validate script before execution
            const validationResult = await securityContext.validateScript(script);
            if (!validationResult.valid) {
                return {
                    success: false,
                    message: 'Script validation failed',
                    error: validationResult.errors.join('; ')
                };
            }

            // Log warnings if any
            if (validationResult.warnings.length > 0) {
                console.warn('[Security]', validationResult.warnings.join('; '));
            }

            // Step 2: Create sandboxed environment
            const sandbox = securityContext.createSandbox();

            // Merge all states from all components
            const mergedStates = this.mergeStates();
            for (const [stateName, stateInfo] of mergedStates.entries()) {
                if (stateInfo.permission === Permission.rw || stateInfo.permission === Permission.w) {
                    sandbox[stateName] = stateInfo.state;
                }
            }

            // Merge all utility functions from all components
            const utilities = this.mergeUtilities();
            for (const [utilName, utilFunc] of Object.entries(utilities)) {
                sandbox[utilName] = utilFunc;
            }

            // Step 3: Start execution with timeout enforcement
            securityContext.startExecution();

            // Step 4: Create and execute the script function
            const AsyncFunction = Object.getPrototypeOf(async function () { }).constructor;
            const scriptFunction = new AsyncFunction(...Object.keys(sandbox), script);

            // Execute the script with sandbox variables
            const result = await scriptFunction(...Object.values(sandbox));

            // Step 5: Stop execution and get stats
            securityContext.stopExecution();
            const stats = securityContext.getExecutionStats();

            console.log('[Execution]', `Completed in ${stats.elapsed}ms with ${stats.iterations} iterations`);

            return {
                success: true,
                message: 'Script executed successfully',
                output: result,
                metadata: {
                    executionTime: stats.elapsed,
                    componentCount: this.components.size,
                    stateCount: mergedStates.size
                }
            };
        } catch (error) {
            securityContext.stopExecution();
            return {
                success: false,
                message: 'Script execution failed',
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * Handle task completion
     */
    async attemptCompletion(result: string): Promise<void> {
        if (!this.completionCallback) {
            throw new Error('No completion callback registered');
        }
        await this.completionCallback(result);
    }

    /**
     * Get common tools for LLM interaction
     */
    getCommonTools(): CommonTools {
        return {
            execute_script: async (script: string) => {
                return this.execute(script);
            },
            attempt_completion: async (result: string) => {
                await this.attemptCompletion(result);
            }
        };
    }

    /**
     * Get all registered component keys
     */
    getComponentKeys(): string[] {
        return Array.from(this.components.keys());
    }

    /**
     * Get a specific component
     */
    getComponent(key: string): StatefulComponent | undefined {
        return this.components.get(key);
    }
}

/**
 * Virtual Workspace - manages multiple StatefulComponents for fine-grained LLM context
 * Merges all states from components and executes scripts centrally
 */
export class VirtualWorkspace {
    private config: VirtualWorkspaceConfig;
    private components: Map<string, ComponentRegistration>;
    private scriptRuntime: ScriptRuntime;

    constructor(config: VirtualWorkspaceConfig) {
        this.config = config;
        this.components = new Map();
        this.scriptRuntime = new ScriptRuntime(new Map(), config.securityConfig || {});
    }

    /**
     * Register a component with the workspace
     */
    registerComponent(registration: ComponentRegistration): void {
        this.components.set(registration.key, registration);

        // Update script runtime with new component
        const componentMap = new Map<string, StatefulComponent>();
        for (const [key, reg] of this.components.entries()) {
            componentMap.set(key, reg.component);
        }
        this.scriptRuntime = new ScriptRuntime(componentMap, this.config.securityConfig || {});
    }

    /**
     * Unregister a component from the workspace
     */
    unregisterComponent(key: string): boolean {
        const removed = this.components.delete(key);
        if (removed) {
            // Update script runtime
            const componentMap = new Map<string, StatefulComponent>();
            for (const [k, reg] of this.components.entries()) {
                componentMap.set(k, reg.component);
            }
            this.scriptRuntime = new ScriptRuntime(componentMap, this.config.securityConfig || {});
        }
        return removed;
    }

    /**
     * Get a registered component
     */
    getComponent(key: string): StatefulComponent | undefined {
        return this.components.get(key)?.component;
    }

    /**
     * Get all registered component keys
     */
    getComponentKeys(): string[] {
        return Array.from(this.components.keys());
    }

    /**
     * Get the script runtime
     */
    getScriptRuntime(): ScriptRuntime {
        return this.scriptRuntime;
    }

    /**
     * Set the completion callback for the script runtime
     */
    setCompletionCallback(callback: CompletionCallback): void {
        this.scriptRuntime.setCompletionCallback(callback);
    }

    /**
     * Get common tools for LLM interaction
     */
    getCommonTools(): CommonTools {
        return this.scriptRuntime.getCommonTools();
    }

    /**
     * Render the entire workspace as context for LLM
     * Components are rendered in priority order (lower priority first)
     */
    async render(): Promise<string> {
        const lines: string[] = [];

        lines.push('╔════════════════════════════════════════════════════════════════════════════════════════╗');
        lines.push(`║  VIRTUAL WORKSPACE: ${this.config.name.padEnd(50)}║`);
        lines.push('╚════════════════════════════════════════════════════════════════════════════════════════╝');

        if (this.config.description) {
            lines.push('');
            lines.push(`Description: ${this.config.description}`);
        }

        lines.push('');
        lines.push(`Workspace ID: ${this.config.id}`);
        lines.push(`Components: ${this.components.size}`);
        lines.push('');

        // Sort components by priority
        const sortedComponents = Array.from(this.components.entries())
            .sort(([, a], [, b]) => (a.priority || 0) - (b.priority || 0));

        for (const [key, registration] of sortedComponents) {
            lines.push('┌────────────────────────────────────────────────────────────────────────────────────┐');
            lines.push(`│ Component: ${key.padEnd(54)}│`);
            lines.push('└────────────────────────────────────────────────────────────────────────────────────┘');
            lines.push('');

            const componentRender = await registration.component.renderWithScriptSection();
            lines.push(componentRender);
            lines.push('');
        }

        return lines.join('\n');
    }

    /**
     * Render the workspace with script writing guide
     */
    async renderWithScriptSection(): Promise<string> {
        const context = await this.render();

        // Generate merged state initialization code
        const lines: string[] = [];

        // Collect all states from all components
        const sortedComponents = Array.from(this.components.entries())
            .sort(([, a], [, b]) => (a.priority || 0) - (b.priority || 0));

        for (const [, registration] of sortedComponents) {
            const states = registration.component.getStates();
            for (const [stateName, state] of Object.entries(states)) {
                if (state.permission === Permission.rw || state.permission === Permission.w) {
                    lines.push(`const ${stateName} = ${JSON.stringify(state.state)};`);
                }
            }
        }

        // Collect all utilities from all components
        for (const [, registration] of sortedComponents) {
            const utilities = registration.component.getScriptUtilities();
            for (const [utilName, utilFunc] of Object.entries(utilities)) {
                lines.push(`const ${utilName} = ${utilFunc.toString()};`);
            }
        }

        lines.push('');
        lines.push('// Available utility functions:');
        for (const [, registration] of sortedComponents) {
            const utilities = registration.component.getScriptUtilities();
            for (const utilName of Object.keys(utilities)) {
                lines.push(`// ${utilName}`);
            }
        }
        lines.push('');

        const stateInitCode = lines.join('\n');

        const scriptSection = `
${context}

╔════════════════════════════════════════════════════════════════════════════════════════╗
║                    SCRIPT EXECUTION GUIDE                                              ║
╚════════════════════════════════════════════════════════════════════════════════════════╝

This workspace contains ${this.components.size} component(s) with merged states. You can interact with them using the following tools:

╔════════════════════════════════════════════════════════════════════════════════════════╗
║                    AVAILABLE TOOLS                                                     ║
╚════════════════════════════════════════════════════════════════════════════════════════╝

1. execute_script(script: string)
   Execute JavaScript code to mutate component states.
   - All states from all components are merged into a single execution context
   - You can access any state directly by its name
   
2. attempt_completion(result: string)
   Complete the task and return the final result.

╔════════════════════════════════════════════════════════════════════════════════════════╗
║                    AVAILABLE STATES (MERGED FROM ALL COMPONENTS)                      ║
╚════════════════════════════════════════════════════════════════════════════════════════╝

${Array.from(this.components.entries())
                .sort(([, a], [, b]) => (a.priority || 0) - (b.priority || 0))
                .map(([key, reg]) => {
                    const states = Object.keys(reg.component.getStates());
                    return `- ${key}: ${states.join(', ')}`;
                })
                .join('\n')}

╔════════════════════════════════════════════════════════════════════════════════════════╗
║                    EXAMPLES                                                            ║
╚════════════════════════════════════════════════════════════════════════════════════════╝

Example 1: Update a state
───────────────────────────────────────────────────────────────────────────────────────
await execute_script(\`
  state_a.value = "new value";
\`);

Example 2: Complex logic with multiple states
───────────────────────────────────────────────────────────────────────────────────────
await execute_script(\`
  if (state_a.value.includes("test")) {
    state_b.count = state_b.count + 1;
  }
\`);

Example 3: Using utility functions
───────────────────────────────────────────────────────────────────────────────────────
await execute_script(\`
  // Use utility functions if available
  const result = someUtilityFunction(state_a);
  state_a.value = result;
\`);

Example 4: Complete the task
───────────────────────────────────────────────────────────────────────────────────────
await attempt_completion("Task completed successfully");

`;

        return scriptSection;
    }

    /**
     * Get workspace configuration
     */
    getConfig(): VirtualWorkspaceConfig {
        return { ...this.config };
    }

    /**
     * Get workspace statistics
     */
    getStats(): {
        componentCount: number;
        componentKeys: string[];
        totalStates: number;
    } {
        let totalStates = 0;
        const componentKeys: string[] = [];

        for (const [key, registration] of this.components.entries()) {
            componentKeys.push(key);
            totalStates += Object.keys(registration.component.getStates()).length;
        }

        return {
            componentCount: this.components.size,
            componentKeys,
            totalStates
        };
    }
}
