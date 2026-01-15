import { proxy } from 'valtio'
import * as z from 'zod';
import { SecurityConfig, SecureExecutionContext, createSecurityConfig } from './scriptSecurity';

export enum Permission {
    r = 'READ_ONLY',
    w = 'WRITE_ONLY',
    rw = 'READ_AND_WRITE'
}
export enum StateType {
    private = 'PRIVATE',
    public = 'PUBLIC',
}
export interface State {
    type: StateType;
    schema: z.Schema
    state: object;
}

/**
 * Public states will be parsed into context 9
 */
export interface PublicState extends State {
    type: StateType.public;
    permission: Permission;
    /**
     * Describe what will happen if state being changed
     */
    sideEffectsDesc?: string;
}

export interface PrivateState extends State {
    type: StateType.private;
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
 * Common tools available to LLM for interacting with the virtual workspace
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
 * - this framework doesn't accept customized llm tools anymore. Instead, it allows LLM to write script to mutate states
 */
export abstract class StatefulComponent {
    protected privateStates: Record<string, PrivateState> = {}
    protected publicStates: Record<string, PublicState> = {}

    /**
     * Security configuration for script execution
     * Override this in subclasses to customize security settings
     */
    protected securityConfig: SecurityConfig = {};

    /**
     * Execute a JavaScript script to mutate public states
     * The script has access to all public states via a sandboxed environment
     *
     * Security features:
     * - Script validation before execution
     * - Timeout enforcement
     * - Iteration limits
     * - Blocked patterns (require, eval, process, etc.)
     * - Controlled global scope
     */
    async executeScript(script: string): Promise<ScriptExecutionResult> {
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

            // Add all public states to sandbox (with write access)
            for (const [key, publicState] of Object.entries(this.publicStates)) {
                if (publicState.permission === Permission.rw || publicState.permission === Permission.w) {
                    sandbox[key] = publicState.state;
                }
            }

            // Add utility functions to sandbox
            const utilities = this.getScriptUtilities();
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
                output: result
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
     * Get available utility functions for script execution
     * Override this to provide component-specific utilities
     */
    protected getScriptUtilities(): Record<string, Function> {
        return {};
    }

    /**
     * Generate JavaScript code snippet for state initialization
     */
    private generateStateInitializationCode(): string {
        const lines: string[] = [];

        for (const [key, publicState] of Object.entries(this.publicStates)) {
            if (publicState.permission === Permission.rw || publicState.permission === Permission.w) {
                lines.push(`const ${key} = ${JSON.stringify(publicState.state)};`);
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

    /**
     * Render the virtual workspace as context for LLM
     * This includes public states and their schemas
     */
    async render(): Promise<string> {
        const lines: string[] = [];

        lines.push('╔════════════════════════════════════════════════════════════════╗');
        lines.push('║                    VIRTUAL WORKSPACE - AVAILABLE STATES                    ║');
        lines.push('╚══════════════════════════════════════════════════════════════╝');
        lines.push('');

        for (const [key, publicState] of Object.entries(this.publicStates)) {
            lines.push('┌─────────────────────────────────────────────────────────────────────────────┐');
            lines.push(`│ State: ${key.padEnd(55)}│`);
            lines.push('├─────────────────────────────────────────────────────────────────────────────┤');

            // Type and Permission
            lines.push(`│ Type:        ${publicState.type.padEnd(49)}│`);
            lines.push(`│ Permission:   ${publicState.permission.padEnd(49)}│`);

            // Schema (simplified representation)
            const schemaStr = this.formatSchema(publicState.schema);
            lines.push(`│ Schema:       ${schemaStr.substring(0, 48).padEnd(49)}│`);

            // Side Effects
            if (publicState.sideEffectsDesc) {
                const sideEffects = publicState.sideEffectsDesc;
                const chunks = this.chunkString(sideEffects, 49);
                lines.push(`│ Side Effects: ${chunks[0].padEnd(49)}│`);
                for (let i = 1; i < chunks.length; i++) {
                    lines.push(`│               ${chunks[i].padEnd(49)}│`);
                }
            }

            // Current Value
            lines.push('├─────────────────────────────────────────────────────────────────────────────┤');
            lines.push('│ Current Value:');
            const valueLines = this.formatValue(publicState.state, 49);
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
    async renderWithScriptSection(): Promise<string> {
        const context = await this.render();
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

╔══════════════════════════════════════════════════════════════════════════════════════════════════╗
║                    HOW TO INTERACT WITH STATES                            ║
╚══════════════════════════════════════════════════════════════════════════════════════════════╝

You can write JavaScript code to mutate states above. Use the state names
directly in your script.

╔══════════════════════════════════════════════════════════════════════════════════════════════════════════════╗
║                           EXAMPLES                                        ║
╚══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════╝

Example 1: Simple state update
─────────────────────────────────────────────────────────────────────────────
await execute_script(\`
  search_box_state.search_pattern = "new search term";
\`);

Example 2: Complex logic with conditions
─────────────────────────────────────────────────────────────────────────────
await execute_script(\`
  if (search_box_state.search_pattern.includes("test")) {
    search_box_state.search_pattern = "filtered";
  }
\`);

Example 3: Using utility functions
─────────────────────────────────────────────────────────────────────────────
await execute_script(\`
  // Use utility functions if available
  const result = someUtilityFunction(search_box_state);
  search_box_state.search_pattern = result;
\`);

Example 4: Complete the task
─────────────────────────────────────────────────────────────────────────────
await attempt_completion("Task completed successfully");

`;
        return scriptSection;
    }
}