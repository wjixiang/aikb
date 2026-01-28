import { proxy } from 'valtio';
import * as z from 'zod';
import { renderInfoBox } from './ui/componentUtils';
import { tdiv, th, tp } from './ui/TUI_elements';
import { State, Permission, ScriptExecutionResult, CommonTools } from './types';

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
     * Uses HTML-like tdiv components for rendering
     */
    async _render(): Promise<string> {
        // Ensure initialization before rendering
        await this.ensureInitialized();

        // Create header section using th (heading) element
        const header = new th({
            content: 'VIRTUAL WORKSPACE - AVAILABLE STATES',
            level: 1,
            underline: true,
            textStyle: { bold: true }
        });

        // Create state cards
        const stateCards: tdiv[] = [];
        for (const [key, state] of Object.entries(this.states)) {
            stateCards.push(this.renderStateCard(key, state));
        }

        // Combine all sections - render header and state cards
        let result = header.render() + '\n\n';
        for (const card of stateCards) {
            result += card.render() + '\n';
        }

        return result.trimEnd();
    }

    /**
     * Render a single state as a card component
     * @param key - State name
     * @param state - State object containing schema, value, and metadata
     * @returns tdiv component representing the state card
     */
    private renderStateCard(key: string, state: State): tdiv {
        const contentLines: string[] = [];

        // State name header
        contentLines.push(`State: ${key}`);
        contentLines.push('');

        // Permission
        contentLines.push(`Permission:   ${state.permission}`);

        // Schema
        const schemaStr = this.formatSchema(state.schema);
        contentLines.push(`Schema:       ${schemaStr}`);

        // Side Effects
        if (state.sideEffectsDesc) {
            contentLines.push(`Side Effects: ${state.sideEffectsDesc}`);
        }

        contentLines.push('');
        contentLines.push('Current Value:');

        // Format value
        const valueStr = JSON.stringify(state.state, null, 2);
        contentLines.push(...valueStr.split('\n'));

        return new tdiv({
            content: contentLines.join('\n'),
            styles: {
                width: 80,
                showBorder: true,
                border: { line: 'single' },
                align: 'left',
                padding: { all: 1 },
                margin: { bottom: 1 }
            }
        });
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
     * Render the context with script section for LLM
     * This provides a template for LLM to write scripts
     * Uses HTML-like tdiv components for rendering
     */
    async render(): Promise<string> {
        const context = await this._render();
        const stateInitCode = this.generateStateInitializationCode();

        // Script writing guide header using th (heading) element
        const scriptHeader = new th({
            content: 'SCRIPT WRITING GUIDE',
            level: 2,
            underline: true
        });

        // State initialization box using th (heading) element
        const initHeader = new th({
            content: 'STATE INITIALIZATION',
            level: 3,
            underline: true
        });

        // Examples header using th (heading) element
        const examplesHeader = new th({
            content: 'EXAMPLES',
            level: 2,
            underline: true
        });

        // Build the script section
        const scriptSection = [
            context,
            '',
            scriptHeader.render(),
            '',
            'Start your script with the following initialization code:',
            '',
            initHeader.render(),
            '',
            stateInitCode,
            '',
            renderInfoBox({ title: 'HOW TO INTERACT WITH STATES' }),
            '',
            'You can write JavaScript code to mutate states above. Use the state names',
            'directly in your script.',
            '',
            examplesHeader.render(),
            '',
            'Example 1: Simple state update',
            '────────────────────────────────────────────────────────────────────────────',
            'await execute_script(`',
            '  search_box_state.search_pattern = "new search term";',
            '`);',
            '',
            'Example 2: Complex logic with conditions',
            '────────────────────────────────────────────────────────────────────────────',
            'await execute_script(`',
            '  if (search_box_state.search_pattern.includes("test")) {',
            '    search_box_state.search_pattern = "filtered";',
            '  }',
            '`);',
            '',
            'Example 3: Using utility functions',
            '────────────────────────────────────────────────────────────────────────────',
            'await execute_script(`',
            '  // Use utility functions if available',
            '  const result = someUtilityFunction(search_box_state);',
            '  search_box_state.search_pattern = result;',
            '`);',
            '',
            'Example 4: Complete the task',
            '────────────────────────────────────────────────────────────────────────────',
            'await attempt_completion("Task completed successfully");'
        ].join('\n');

        return scriptSection;
    }
}
export { Permission };
export type { State };

