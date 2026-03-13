/**
 * Hello Component
 *
 * 简单的测试组件 - 向用户打招呼
 */

import { ToolComponent } from 'agent-lib';
import { tdiv, type TUIElement } from 'agent-lib';
import { z } from 'zod';

/**
 * HelloComponent - 向用户发送问候消息
 */
export class HelloComponent extends ToolComponent {
  override readonly componentId = 'hello';
  override readonly displayName = 'Hello Component';
  override readonly description = 'A simple test component that says hello';

  override toolSet: Map<string, { toolName: string; paramsSchema: z.ZodTypeAny; desc: string }> = new Map([
    ['hello', {
      toolName: 'hello',
      desc: 'Say hello with a message',
      paramsSchema: z.object({
        name: z.string().describe('Name to greet')
      })
    }]
  ]);

  private message = 'Hello, World!';

  override renderImply: () => Promise<TUIElement[]> = async () => {
    return [
      new tdiv({
        content: `Message: ${this.message}`,
        styles: { showBorder: false }
      })
    ];
  };

  override handleToolCall: (toolName: string, params: any) => Promise<void> = async (toolName, params) => {
    if (toolName === 'hello') {
      this.message = `Hello, ${params.name}!`;
    }
  };

  override getState() {
    return { message: this.message };
  }
}
