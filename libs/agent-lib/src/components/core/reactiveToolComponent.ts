import { proxy, subscribe, snapshot as takeSnapshot } from 'valtio';
import { injectable } from 'inversify';
import { z } from 'zod';
import {
  ToolComponent,
  type ComponentStateBase,
  type ExportResult,
  type ExportOptions,
} from './toolComponent.js';
import type { Tool, ToolCallResult } from './types.js';
import type { TUIElement } from '../ui/TUIElement.js';

export interface ToolDef {
  desc: string;
  paramsSchema: z.ZodTypeAny;
  examples?: Tool['examples'];
}

type ToolDefs = Record<string, ToolDef>;

type ToolHandlerMap<T> = {
  [K in keyof T as K extends string ? `on${Capitalize<K>}` : never]?: (
    params: any,
  ) => Promise<ToolCallResult<any>>;
};

/**
 * ReactiveToolComponent - Modern reactive base class for tool components.
 *
 * Improvements over ToolComponent:
 * 1. **valtio reactive state** - mutations automatically tracked via proxy
 * 2. **Auto-dispatch** - tool calls route to `on<ToolName>()` methods by convention
 * 3. **Declarative tools** - `toolDefs()` replaces verbose `new Map()` construction
 * 4. **Built-in export** - `exportData` uses valtio snapshot automatically
 * 5. **State subscription** - `subscribeState()` for side-effect wiring
 *
 * @example
 * ```typescript
 * class BookViewer extends ReactiveToolComponent<{
 *   books: BookInfo[];
 *   selected: string | null;
 *   results: string[];
 * }> {
 *   componentId = 'book-viewer';
 *   componentPrompt = 'Browse and search books...';
 *
 *   protected initialState() {
 *     return { books: [], selected: null, results: [] };
 *   }
 *
 *   protected toolDefs() {
 *     return {
 *       selectBook: {
 *         desc: 'Select a book',
 *         paramsSchema: z.object({ bookName: z.string() }),
 *       },
 *       search: {
 *         desc: 'Search content',
 *         paramsSchema: z.object({ query: z.string() }),
 *       },
 *     };
 *   }
 *
 *   async onSelectBook(params: { bookName: string }) {
 *     this.reactive.selected = params.bookName;
 *     return { success: true, data: { selected: params.bookName } };
 *   }
 *
 *   async onSearch(params: { query: string }) {
 *     this.reactive.results = await doSearch(params.query);
 *     return { success: true, data: { count: this.snapshot.results.length } };
 *   }
 *
 *   renderImply = async () => {
 *     const s = this.snapshot;
 *     return [
 *       new tdiv({ content: `Selected: ${s.selected ?? 'None'}` }),
 *       new tdiv({ content: `Results: ${s.results.length}` }),
 *     ];
 *   };
 * }
 * ```
 */
@injectable()
export abstract class ReactiveToolComponent<
  TState extends Record<string, any> = Record<string, any>,
> extends ToolComponent {
  private readonly _reactive = proxy<TState>(this.initialState());
  private _unsubscribers: (() => void)[] = [];

  protected initialState(): TState {
    return {} as TState;
  }

  protected get reactive(): TState {
    return this._reactive;
  }

  protected get snapshot(): TState {
    return takeSnapshot(this._reactive) as TState;
  }

  protected toolDefs(): ToolDefs {
    return {};
  }

  override get toolSet(): Map<string, Tool> {
    const map = new Map<string, Tool>();
    for (const [name, def] of Object.entries(this.toolDefs())) {
      map.set(name, {
        toolName: name,
        paramsSchema: def.paramsSchema,
        desc: def.desc,
        examples: def.examples,
      });
    }
    return map;
  }

  override handleToolCall = async (
    toolName: string,
    params: any,
  ): Promise<ToolCallResult<any>> => {
    const handlerName =
      'on' + toolName.charAt(0).toUpperCase() + toolName.slice(1);
    const handler = (this as any)[handlerName];
    if (typeof handler !== 'function') {
      throw new Error(
        `[${this.componentId}] Tool handler "${handlerName}" not found. ` +
          `Define "async ${handlerName}(params)" to handle tool "${toolName}".`,
      );
    }
    return handler.call(this, params);
  };

  protected subscribeState(callback: () => void): () => void {
    const unsub = subscribe(this._reactive, callback);
    this._unsubscribers.push(unsub);
    return unsub;
  }

  override exportState(): ComponentStateBase {
    return {
      ...super.exportState(),
      ...(takeSnapshot(this._reactive) as Record<string, unknown>),
    };
  }

  override restoreState(state: ComponentStateBase): void {
    super.restoreState(state);
    const keys = Object.keys(this.initialState());
    const saved = Object.fromEntries(
      keys.filter((k) => k in state).map((k) => [k, (state as any)[k]]),
    );
    if (Object.keys(saved).length > 0) {
      Object.assign(this._reactive, saved);
    }
  }

  override async exportData(options?: ExportOptions): Promise<ExportResult> {
    return {
      data: takeSnapshot(this._reactive),
      format: options?.format ?? 'json',
      metadata: { componentId: this.componentId },
    };
  }

  override onActivate = async (): Promise<void> => {
    this._unsubscribers = [];
  };

  override onDeactivate = async (): Promise<void> => {
    for (const unsub of this._unsubscribers) {
      unsub();
    }
    this._unsubscribers = [];
  };
}
