import {
  ReactiveToolComponent,
  type ToolCallResult,
  type TUIElement,
  tdiv,
} from '../../../components/index.js';
import * as z from 'zod';

/**
 * Basic TestComponent - Simple component for testing registration
 * Has a single test_tool
 */
export class TestComponent extends ReactiveToolComponent {
  override readonly componentId = 'test-component';
  override readonly displayName = 'Test Component';
  override readonly description = 'A test component';
  override componentPrompt = 'Test component prompt';

  protected override toolDefs() {
    return {
      test_tool: {
        desc: 'A test tool',
        paramsSchema: z.object({}),
      },
    };
  }

  renderImply = async (): Promise<TUIElement[]> => {
    return [];
  };

  async onTest_tool(): Promise<ToolCallResult<any>> {
    return { success: true, data: { success: true } };
  }
}

/**
 * TestComponent2 - Another component with different ID for testing
 */
export class TestComponent2 extends ReactiveToolComponent {
  override readonly componentId = 'test-component-2';
  override readonly displayName = 'Test Component 2';
  override readonly description = 'Another test component';
  override componentPrompt = 'Test component 2 prompt';

  protected override toolDefs() {
    return {
      test_tool: {
        desc: 'A test tool',
        paramsSchema: z.object({}),
      },
    };
  }

  renderImply = async (): Promise<TUIElement[]> => {
    return [];
  };

  async onTest_tool(): Promise<ToolCallResult<any>> {
    return { success: true, data: { success: true } };
  }
}

/**
 * AnotherComponent - Component with different tool for testing
 */
export class AnotherComponent extends ReactiveToolComponent {
  override readonly componentId = 'another-component';
  override readonly displayName = 'Another Component';
  override readonly description = 'Another test component';
  override componentPrompt = 'Another component prompt';

  protected override toolDefs() {
    return {
      another_tool: {
        desc: 'Another test tool',
        paramsSchema: z.object({}),
      },
    };
  }

  renderImply = async (): Promise<TUIElement[]> => {
    return [];
  };

  async onAnother_tool(): Promise<ToolCallResult<any>> {
    return { success: true, data: { success: true } };
  }
}

/**
 * Test component A - Search functionality
 * Provides a search tool that stores query and results
 */
export class TestToolComponentA extends ReactiveToolComponent<{
  searchQuery: string;
  searchResults: string[];
}> {
  override componentPrompt = 'Test tool component A prompt';

  protected override initialState() {
    return { searchQuery: '', searchResults: [] };
  }

  protected override toolDefs() {
    return {
      search: {
        desc: 'Search for something',
        paramsSchema: z.object({ query: z.string() }),
      },
    };
  }

  renderImply = async (): Promise<tdiv[]> => {
    const s = this.snapshot;
    return [
      new tdiv({
        content: `Search Query: ${s.searchQuery}`,
        styles: { width: 80, showBorder: false },
      }),
      new tdiv({
        content: `Results: ${s.searchResults.join(', ')}`,
        styles: { width: 80, showBorder: false },
      }),
    ];
  };

  async onSearch(params: { query: string }): Promise<ToolCallResult<any>> {
    this.reactive.searchQuery = params.query;
    this.reactive.searchResults = [
      `result1 for ${params.query}`,
      `result2 for ${params.query}`,
    ];
    return {
      success: true,
      data: { query: params.query, results: this.snapshot.searchResults },
      summary: `[TestA] 搜索: ${params.query}, 找到 ${this.snapshot.searchResults.length} 个结果`,
    };
  }

  getSearchQuery(): string {
    return this.snapshot.searchQuery;
  }

  getSearchResults(): string[] {
    return this.snapshot.searchResults;
  }
}

/**
 * Test component B - Counter functionality
 * Provides an increment tool to increase a counter
 */
export class TestToolComponentB extends ReactiveToolComponent<{
  counter: number;
}> {
  override componentPrompt = 'Test tool component B prompt';

  protected override initialState() {
    return { counter: 0 };
  }

  protected override toolDefs() {
    return {
      increment: {
        desc: 'Increment counter',
        paramsSchema: z.object({ amount: z.number().optional() }),
      },
    };
  }

  renderImply = async (): Promise<tdiv[]> => {
    return [
      new tdiv({
        content: `Counter: ${this.snapshot.counter}`,
        styles: { width: 80, showBorder: false },
      }),
    ];
  };

  async onIncrement(params: { amount?: number }): Promise<ToolCallResult<any>> {
    const amount = params.amount || 1;
    this.reactive.counter += amount;
    return {
      success: true,
      data: { counter: this.snapshot.counter, increment: amount },
      summary: `[TestB] 计数器: +${amount}, 当前值: ${this.snapshot.counter}`,
    };
  }

  getCounter(): number {
    return this.snapshot.counter;
  }
}

/**
 * Test component C - Toggle functionality
 * Provides a toggle tool to flip a boolean flag
 */
export class TestToolComponentC extends ReactiveToolComponent<{
  flag: boolean;
}> {
  override componentPrompt = 'Test tool component C prompt';

  protected override initialState() {
    return { flag: false };
  }

  protected override toolDefs() {
    return {
      toggle: {
        desc: 'Toggle flag',
        paramsSchema: z.object({}),
      },
    };
  }

  renderImply = async (): Promise<tdiv[]> => {
    return [
      new tdiv({
        content: `Flag: ${this.snapshot.flag}`,
        styles: { width: 80, showBorder: false },
      }),
    ];
  };

  async onToggle(): Promise<ToolCallResult<any>> {
    this.reactive.flag = !this.snapshot.flag;
    return {
      success: true,
      data: { flag: this.snapshot.flag },
      summary: `[TestC] 开关: ${this.snapshot.flag ? 'ON' : 'OFF'}`,
    };
  }

  getFlag(): boolean {
    return this.snapshot.flag;
  }
}
