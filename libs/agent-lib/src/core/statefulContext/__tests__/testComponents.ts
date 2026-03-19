import { ToolComponent, type Tool, type ToolCallResult, type TUIElement, type ExportOptions, tdiv } from '../../../components/index.js';
import * as z from 'zod';

/**
 * Basic TestComponent - Simple component for testing registration
 * Has a single test_tool
 */
export class TestComponent extends ToolComponent {
    override readonly componentId = 'test-component';
    override readonly displayName = 'Test Component';
    override readonly description = 'A test component';

    toolSet = new Map<string, Tool>([
        ['test_tool', {
            toolName: 'test_tool',
            paramsSchema: z.object({}),
            desc: 'A test tool',
        }],
    ]);

    renderImply = async (): Promise<TUIElement[]> => {
        return [];
    };

    handleToolCall = async (toolName: string, params: any): Promise<ToolCallResult<any>> => {
        return { success: true, data: { success: true } };
    };

    async exportData(options?: ExportOptions) {
        return { data: {}, format: options?.format ?? 'json', metadata: { componentId: this.componentId } };
    }
}

/**
 * TestComponent2 - Another component with different ID for testing
 */
export class TestComponent2 extends ToolComponent {
    override readonly componentId = 'test-component-2';
    override readonly displayName = 'Test Component 2';
    override readonly description = 'Another test component';

    toolSet = new Map<string, Tool>([
        ['test_tool', {
            toolName: 'test_tool',
            paramsSchema: z.object({}),
            desc: 'A test tool',
        }],
    ]);

    renderImply = async (): Promise<TUIElement[]> => {
        return [];
    };

    handleToolCall = async (toolName: string, params: any): Promise<ToolCallResult<any>> => {
        return { success: true, data: { success: true } };
    };

    async exportData(options?: ExportOptions) {
        return { data: {}, format: options?.format ?? 'json', metadata: { componentId: this.componentId } };
    }
}

/**
 * AnotherComponent - Component with different tool for testing
 */
export class AnotherComponent extends ToolComponent {
    override readonly componentId = 'another-component';
    override readonly displayName = 'Another Component';
    override readonly description = 'Another test component';

    toolSet = new Map<string, Tool>([
        ['another_tool', {
            toolName: 'another_tool',
            paramsSchema: z.object({}),
            desc: 'Another test tool',
        }],
    ]);

    renderImply = async (): Promise<TUIElement[]> => {
        return [];
    };

    handleToolCall = async (toolName: string, params: any): Promise<ToolCallResult<any>> => {
        return { success: true, data: { success: true } };
    };

    async exportData(options?: ExportOptions) {
        return { data: {}, format: options?.format ?? 'json', metadata: { componentId: this.componentId } };
    }
}

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

    handleToolCall = async (toolName: string, params: any): Promise<ToolCallResult<any>> => {
        if (toolName === 'search') {
            this.searchQuery = params.query;
            this.searchResults = [`result1 for ${params.query}`, `result2 for ${params.query}`];
            return {
                success: true,
                data: { query: params.query, results: this.searchResults },
                summary: `[TestA] 搜索: ${params.query}, 找到 ${this.searchResults.length} 个结果`
            };
        }
        return { success: false, data: { error: 'Unknown tool' } };
    };

    getSearchQuery(): string {
        return this.searchQuery;
    }

    getSearchResults(): string[] {
        return this.searchResults;
    }

    async exportData(options?: ExportOptions) {
        return {
            data: { searchQuery: this.searchQuery, searchResults: this.searchResults },
            format: options?.format ?? 'json',
            metadata: { componentId: this.componentId },
        };
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

    handleToolCall = async (toolName: string, params: any): Promise<ToolCallResult<any>> => {
        if (toolName === 'increment') {
            const amount = params.amount || 1;
            this.counter += amount;
            return {
                success: true,
                data: { counter: this.counter, increment: amount },
                summary: `[TestB] 计数器: +${amount}, 当前值: ${this.counter}`
            };
        }
        return { success: false, data: { error: 'Unknown tool' } };
    };

    getCounter(): number {
        return this.counter;
    }

    async exportData(options?: ExportOptions) {
        return {
            data: { counter: this.counter },
            format: options?.format ?? 'json',
            metadata: { componentId: this.componentId },
        };
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

    handleToolCall = async (toolName: string, params: any): Promise<ToolCallResult<any>> => {
        if (toolName === 'toggle') {
            this.flag = !this.flag;
            return {
                success: true,
                data: { flag: this.flag },
                summary: `[TestC] 开关: ${this.flag ? 'ON' : 'OFF'}`
            };
        }
        return { success: false, data: { error: 'Unknown tool' } };
    };

    getFlag(): boolean {
        return this.flag;
    }

    async exportData(options?: ExportOptions) {
        return {
            data: { flag: this.flag },
            format: options?.format ?? 'json',
            metadata: { componentId: this.componentId },
        };
    }
}
