import { proxy } from 'valtio'
import * as z from 'zod';
import { renderInfoBox } from './components/aesthetics/componentUtils';

export enum Permission {
    r = 'READ_ONLY',
    w = 'WRITE_ONLY',
    rw = 'READ_AND_WRITE'
}

/**
 * State definition for components
 * All states are now unified - no distinction between public and private
 */
export interface State {
    /**
     * Schema defining the structure of the state
     */
    schema: z.Schema;
    /**
     * The actual state data (using valtio proxy for reactivity)
     */
    state: object;
    /**
     * Permission level for script execution
     */
    permission: Permission;
    /**
     * Describe what will happen if state being changed
     */
    sideEffectsDesc?: string;
}

/**
 * Result of script execution
 */
export interface ScriptExecutionResult {
    success: boolean;
    message: string;
    output?: any;
    error?: string;
}

/**
 * Common tools available to LLM for interacting with virtual workspace
 */
export interface CommonTools {
    /**
     * Execute a script to mutate states
     */
    execute_script: (script: string) => Promise<ScriptExecutionResult>;
    /**
     * Complete the task and return final result
     */
    attempt_completion: (result: string) => Promise<void>;
}

/**
 * Fully state-controlled interactive component
 * - Components define their states (unified state model)
 * - Script execution is handled by the VirtualWorkspace, not by individual components
 * - Components can provide utility functions for script execution
 */
export abstract class StatefulComponent {
    /**
     * All states managed by this component
     * No distinction between public and private - all states are accessible
     */
    protected states: Record<string, State> = {};

    /**
     * Get all states for workspace to merge
     */
    getStates(): Record<string, State> {
        return this.states;
    }

    /**
     * Get available utility functions for script execution
     * Override this to provide component-specific utilities
     */
    getScriptUtilities(): Record<string, Function> {
        return {};
    }

    /**
     * Generate JavaScript code snippet for state initialization
     */
    private generateStateInitializationCode(): string {
        const lines: string[] = [];

        for (const [key, state] of Object.entries(this.states)) {
            if (state.permission === Permission.rw || state.permission === Permission.w) {
                lines.push(`const ${key} = ${JSON.stringify(state.state)};`);
            }
        }

        // Add utility functions
        const utilities = this.getScriptUtilities();
        for (const [utilName, utilFunc] of Object.entries(utilities)) {
            lines.push(`const ${utilName} = ${utilFunc.toString()};`);
        }
        lines.push('');
        lines.push('// Available utility functions:');
        for (const utilName of Object.keys(utilities)) {
            lines.push(`// ${utilName}`);
        }
        lines.push('');

        return lines.join('\n');
    }

    protected isInit = false;

    /**
     * Abstract initialization method that subclasses must implement
     * This method should set up the component's states and any other initialization logic
     */
    protected abstract init(): Promise<void>;

    /**
     * Ensure the component is initialized before rendering
     */
    protected async ensureInitialized(): Promise<void> {
        if (!this.isInit) {
            await this.init();
            this.isInit = true;
        }
    }

    /**
     * Render the virtual workspace as context for LLM (internal method)
     * This includes states and their schemas
     */
    async _render(): Promise<string> {
        // Ensure initialization before rendering
        await this.ensureInitialized();
        const lines: string[] = [];

        lines.push('╔════════════════════════════════════════════════════════════════╗');
        lines.push('║                    VIRTUAL WORKSPACE - AVAILABLE STATES                    ║');
        lines.push('╚════════════════════════════════════════════════════════════════╝');
        lines.push('');

        for (const [key, state] of Object.entries(this.states)) {
            lines.push('┌─────────────────────────────────────────────────────────────────────────────┐');
            lines.push(`│ State: ${key.padEnd(55)}│`);
            lines.push('├─────────────────────────────────────────────────────────────────────────────┤');

            // Permission
            lines.push(`│ Permission:   ${state.permission.padEnd(49)}│`);

            // Schema (simplified representation)
            const schemaStr = this.formatSchema(state.schema);
            lines.push(`│ Schema:       ${schemaStr.substring(0, 48).padEnd(49)}│`);

            // Side Effects
            if (state.sideEffectsDesc) {
                const sideEffects = state.sideEffectsDesc;
                const chunks = this.chunkString(sideEffects, 49);
                lines.push(`│ Side Effects: ${chunks[0].padEnd(49)}│`);
                for (let i = 1; i < chunks.length; i++) {
                    lines.push(`│               ${chunks[i].padEnd(49)}│`);
                }
            }

            // Current Value
            lines.push('├─────────────────────────────────────────────────────────────────────────────┤');
            lines.push('│ Current Value:');
            const valueLines = this.formatValue(state.state, 49);
            for (const line of valueLines) {
                lines.push(`│ ${line.padEnd(65)}│`);
            }

            lines.push('└─────────────────────────────────────────────────────────────────────────────┘');
            lines.push('');
        }

        return lines.join('\n');
    }

    /**
     * Format schema for display
     */
    private formatSchema(schema: z.Schema): string {
        try {
            const description = (schema as any).description || 'Object';
            return description;
        } catch {
            return 'Unknown';
        }
    }

    /**
     * Chunk string into multiple lines
     */
    private chunkString(str: string, maxLen: number): string[] {
        const chunks: string[] = [];
        for (let i = 0; i < str.length; i += maxLen) {
            chunks.push(str.substring(i, i + maxLen));
        }
        return chunks;
    }

    /**
     * Format value for display
     */
    private formatValue(value: any, maxLen: number): string[] {
        const str = JSON.stringify(value, null, 2);
        const lines: string[] = [];

        for (const line of str.split('\n')) {
            if (line.length <= maxLen) {
                lines.push(line);
            } else {
                const chunks = this.chunkString(line, maxLen);
                for (const chunk of chunks) {
                    lines.push(chunk);
                }
            }
        }

        return lines;
    }

    /**
     * Render the context with script section for LLM
     * This provides a template for LLM to write scripts
     */
    async render(): Promise<string> {
        const context = await this._render();
        const stateInitCode = this.generateStateInitializationCode();

        const scriptSection = `
${context}

╔══════════════════════════════════════════════════════════════════════╗
║                    SCRIPT WRITING GUIDE                              ║
╚══════════════════════════════════════════════════════════════════════╝

Start your script with the following initialization code:

╔════════════════════════════════════════════════════════════════════╗
║                  STATE INITIALIZATION                              ║
╚════════════════════════════════════════════════════════════════════╝
${stateInitCode}
${renderInfoBox({
            title: 'HOW TO INTERACT WITH STATES '
        })}


You can write JavaScript code to mutate states above. Use the state names
directly in your script.

╔══════════════════════════════════════════════════════════════════════════════════════════════════════════════╗
║                           EXAMPLES                                        ║
╚══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════╝

Example 1: Simple state update
────────────────────────────────────────────────────────────────────────────
await execute_script(\`
  search_box_state.search_pattern = "new search term";
\`);

Example 2: Complex logic with conditions
────────────────────────────────────────────────────────────────────────────
await execute_script(\`
  if (search_box_state.search_pattern.includes("test")) {
    search_box_state.search_pattern = "filtered";
  }
\`);

Example 3: Using utility functions
────────────────────────────────────────────────────────────────────────────
await execute_script(\`
  // Use utility functions if available
  const result = someUtilityFunction(search_box_state);
  search_box_state.search_pattern = result;
\`);

Example 4: Complete the task
────────────────────────────────────────────────────────────────────────────
await attempt_completion("Task completed successfully");

`;
        return scriptSection;
    }
}
