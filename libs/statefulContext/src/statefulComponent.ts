import { proxy } from 'valtio';
import * as z from 'zod';
import { renderInfoBox } from './ui/componentUtils';
import { tdiv, th, tp, TUIElement } from './ui';
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
    async _render(): Promise<TUIElement> {
        // Ensure initialization before rendering
        await this.ensureInitialized();

        // Create a container tdiv to hold all content
        const container = new tdiv({
            content: '',
            styles: {
                width: 80,
                showBorder: false
            }
        });

        // Create header section using th (heading) element
        const header = new th({
            content: 'VIRTUAL WORKSPACE - AVAILABLE STATES',
            level: 1,
            underline: true,
            textStyle: { bold: true }
        });

        // Add header as a child (wrap in tdiv for spacing)
        const headerDiv = new tdiv({
            content: header.render(),
            styles: {
                width: 80,
                showBorder: false,
                margin: { bottom: 1 }
            }
        });
        container.addChild(headerDiv);

        // Create state cards and add as children
        for (const [key, state] of Object.entries(this.states)) {
            container.addChild(this.renderStateCard(key, state));
        }

        return container;
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
    async render(): Promise<TUIElement> {
        const context = await this._render();
        const stateInitCode = this.generateStateInitializationCode();

        // Create a container tdiv to hold all content
        const container = new tdiv({
            content: '',
            styles: {
                width: 80,
                showBorder: false
            }
        });

        // Add context (states section)
        container.addChild(context);

        // Add spacing
        container.addChild(new tdiv({
            content: '',
            styles: { width: 80, showBorder: false, margin: { bottom: 1 } }
        }));

        // Script writing guide header using th (heading) element
        const scriptHeader = new th({
            content: 'SCRIPT WRITING GUIDE',
            level: 2,
            underline: true
        });

        container.addChild(new tdiv({
            content: scriptHeader.render(),
            styles: { width: 80, showBorder: false, margin: { bottom: 1 } }
        }));

        // Introduction text
        container.addChild(new tdiv({
            content: 'Start your script with the following initialization code:',
            styles: { width: 80, showBorder: false, margin: { bottom: 1 } }
        }));

        // State initialization box using th (heading) element
        const initHeader = new th({
            content: 'STATE INITIALIZATION',
            level: 3,
            underline: true
        });

        container.addChild(new tdiv({
            content: initHeader.render(),
            styles: { width: 80, showBorder: false, margin: { bottom: 1 } }
        }));

        // State initialization code
        container.addChild(new tdiv({
            content: stateInitCode,
            styles: { width: 80, showBorder: false, margin: { bottom: 1 } }
        }));

        // Info box
        container.addChild(new tdiv({
            content: renderInfoBox({ title: 'HOW TO INTERACT WITH STATES' }),
            styles: { width: 80, showBorder: false, margin: { bottom: 1 } }
        }));

        // Description text
        container.addChild(new tdiv({
            content: 'You can write JavaScript code to mutate states above. Use the state names\ndirectly in your script.',
            styles: { width: 80, showBorder: false, margin: { bottom: 1 } }
        }));

        // Examples header using th (heading) element
        const examplesHeader = new th({
            content: 'EXAMPLES',
            level: 2,
            underline: true
        });

        container.addChild(new tdiv({
            content: examplesHeader.render(),
            styles: { width: 80, showBorder: false, margin: { bottom: 1 } }
        }));

        // Example 1
        container.addChild(new tdiv({
            content: 'Example 1: Simple state update\n────────────────────────────────────────────────────────────────────────────\nawait execute_script(`\n  search_box_state.search_pattern = "new search term";\n`);',
            styles: { width: 80, showBorder: false, margin: { bottom: 1 } }
        }));

        // Example 2
        container.addChild(new tdiv({
            content: 'Example 2: Complex logic with conditions\n────────────────────────────────────────────────────────────────────────────\nawait execute_script(`\n  if (search_box_state.search_pattern.includes("test")) {\n    search_box_state.search_pattern = "filtered";\n  }\n`);',
            styles: { width: 80, showBorder: false, margin: { bottom: 1 } }
        }));

        // Example 3
        container.addChild(new tdiv({
            content: 'Example 3: Using utility functions\n────────────────────────────────────────────────────────────────────────────\nawait execute_script(`\n  // Use utility functions if available\n  const result = someUtilityFunction(search_box_state);\n  search_box_state.search_pattern = result;\n`);',
            styles: { width: 80, showBorder: false, margin: { bottom: 1 } }
        }));

        // Example 4
        container.addChild(new tdiv({
            content: 'Example 4: Complete the task\n────────────────────────────────────────────────────────────────────────────\nawait attempt_completion("Task completed successfully");',
            styles: { width: 80, showBorder: false }
        }));

        return container;
    }
}
export { Permission };
export type { State };

