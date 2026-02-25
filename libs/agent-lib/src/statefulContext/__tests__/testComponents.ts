import { ToolComponent } from '../toolComponent.js';
import { Tool } from '../types.js';
import { tdiv } from '../ui/index.js';
import * as z from 'zod';

/**
 * Test component A - Search functionality
 * Provides a search tool that stores query and results
 */
export class TestToolComponentA extends ToolComponent {
    toolSet = new Map<string, Tool>([
        ['search', {
            toolName: 'search',
            desc: 'Search for something',
            paramsSchema: z.object({ query: z.string() })
        }]
    ]);

    private searchQuery = '';
    private searchResults: string[] = [];

    renderImply = async (): Promise<tdiv[]> => {
        return [
            new tdiv({
                content: `Search Query: ${this.searchQuery}`,
                styles: { width: 80, showBorder: false }
            }),
            new tdiv({
                content: `Results: ${this.searchResults.join(', ')}`,
                styles: { width: 80, showBorder: false }
            })
        ];
    };

    handleToolCall = async (toolName: string, params: any): Promise<void> => {
        if (toolName === 'search') {
            this.searchQuery = params.query;
            this.searchResults = [`result1 for ${params.query}`, `result2 for ${params.query}`];
        }
    };

    getSearchQuery(): string {
        return this.searchQuery;
    }

    getSearchResults(): string[] {
        return this.searchResults;
    }
}

/**
 * Test component B - Counter functionality
 * Provides an increment tool to increase a counter
 */
export class TestToolComponentB extends ToolComponent {
    toolSet = new Map<string, Tool>([
        ['increment', {
            toolName: 'increment',
            desc: 'Increment counter',
            paramsSchema: z.object({ amount: z.number().optional() })
        }]
    ]);

    private counter = 0;

    renderImply = async (): Promise<tdiv[]> => {
        return [
            new tdiv({
                content: `Counter: ${this.counter}`,
                styles: { width: 80, showBorder: false }
            })
        ];
    };

    handleToolCall = async (toolName: string, params: any): Promise<void> => {
        if (toolName === 'increment') {
            this.counter += params.amount || 1;
        }
    };

    getCounter(): number {
        return this.counter;
    }
}

/**
 * Test component C - Toggle functionality
 * Provides a toggle tool to flip a boolean flag
 */
export class TestToolComponentC extends ToolComponent {
    toolSet = new Map<string, Tool>([
        ['toggle', {
            toolName: 'toggle',
            desc: 'Toggle flag',
            paramsSchema: z.object({})
        }]
    ]);

    private flag = false;

    renderImply = async (): Promise<tdiv[]> => {
        return [
            new tdiv({
                content: `Flag: ${this.flag}`,
                styles: { width: 80, showBorder: false }
            })
        ];
    };

    handleToolCall = async (toolName: string, params: any): Promise<void> => {
        if (toolName === 'toggle') {
            this.flag = !this.flag;
        }
    };

    getFlag(): boolean {
        return this.flag;
    }
}
