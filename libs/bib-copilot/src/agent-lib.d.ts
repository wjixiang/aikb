declare module 'agent-lib/components' {
  export { ToolComponent } from 'agent-lib/components/core/types';
  export type { ToolCallResult, ToolDef, ExportOptions } from 'agent-lib/components/core/types';
}

declare module 'agent-lib/components/core/types' {
  import type { z } from 'zod';

  export interface Tool {
    toolName: string;
    paramsSchema: z.ZodTypeAny;
    desc: string;
    examples?: ToolExample[];
  }

  export interface ToolExample {
    description: string;
    params: Record<string, unknown>;
    expectedResult?: string;
  }

  export interface ToolCallResult<T = unknown> {
    success: boolean;
    data: T;
    summary?: string;
  }

  export interface ToolDef {
    desc: string;
    paramsSchema: z.ZodTypeAny;
    examples?: Tool['examples'];
  }

  export interface ExportOptions {
    format?: string;
    filter?: Record<string, unknown>;
    params?: Record<string, unknown>;
  }

  export abstract class ToolComponent<TState extends Record<string, any> = Record<string, any>> {
    componentId: string;
    displayName: string;
    description: string;
    componentPrompt: string;
    protected reactive: TState;
    protected get snapshot(): TState;
    protected initialState(): TState;
    protected toolDefs(): Record<string, ToolDef>;
    get toolSet(): Map<string, Tool>;
    handleToolCall(toolName: string, params: any): Promise<ToolCallResult<any>>;
    renderImply: () => Promise<any>;
  }
}

declare module 'agent-lib/components/ui' {
  export class tdiv {
    constructor(options: { content: string; styles?: Record<string, number | string> });
  }
  export class th {
    constructor(options: { content: string; level?: number; underline?: boolean });
  }
  export class tp {
    constructor(options: { content: string; indent?: number });
  }
  export type TUIElement = tdiv | th | tp;
}
