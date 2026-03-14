/**
 * Calculator Component
 *
 * 简单的计算器组件 - 支持基本数学运算
 */

import { ToolComponent } from 'agent-lib/components';
import { tdiv, type TUIElement } from 'agent-lib/components'
import { z } from 'zod';

/**
 * CalculatorComponent - 简单计算器
 */
export class HelloComponent extends ToolComponent {
  override readonly componentId = 'calculator';
  override readonly displayName = 'Calculator';
  override readonly description = 'A simple calculator with basic operations';
  override toolSet: Map<string, { toolName: string; paramsSchema: z.ZodTypeAny; desc: string }> = new Map([
    ['add', {
      toolName: 'add',
      desc: 'Add two numbers',
      paramsSchema: z.object({
        a: z.number(),
        b: z.number()
      })
    }],
    ['subtract', {
      toolName: 'subtract',
      desc: 'Subtract b from a',
      paramsSchema: z.object({
        a: z.number(),
        b: z.number()
      })
    }],
    ['multiply', {
      toolName: 'multiply',
      desc: 'Multiply two numbers',
      paramsSchema: z.object({
        a: z.number(),
        b: z.number()
      })
    }],
    ['divide', {
      toolName: 'divide',
      desc: 'Divide a by b',
      paramsSchema: z.object({
        a: z.number(),
        b: z.number()
      })
    }]
  ]);

  private lastResult: number | null = null;

  currentTask: string = ''

  override renderImply: () => Promise<TUIElement[]> = async () => {
    return [
      new tdiv({
        content: `
        Calculate: ${this.currentTask}
        Last Result: ${this.lastResult ?? 'None'}`,
        styles: { showBorder: false }
      })
    ];
  };

  override handleToolCall: (toolName: string, params: any) => Promise<void> = async (toolName, params) => {
    const { a, b } = params;
    switch (toolName) {
      case 'add':
        this.currentTask = `${a} + ${b}`
        this.lastResult = a + b;
        break;
      case 'subtract':
        this.currentTask = `${a} - ${b}`
        this.lastResult = a - b;
        break;
      case 'multiply':
        this.lastResult = a * b;
        break;
      case 'divide':
        this.lastResult = b !== 0 ? a / b : NaN;
        break;
    }
  };

  override getState() {
    return { lastResult: this.lastResult };
  }
}
