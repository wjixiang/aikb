import { proxy, subscribe, snapshot as takeSnapshot } from 'valtio';
import { injectable, type Container } from 'inversify';
import { z } from 'zod';
import { renderToolSection } from '../utils/toolRendering.js';
import type { Tool, ToolCallResult } from './types.js';
import { tdiv } from '../ui/tdiv.js';
import { TUIElement } from '../ui/TUIElement.js';
import { MdDiv } from '../ui/markdown/MdDiv.js';
import { MdElement } from '../ui/markdown/MdElement.js';

/**
 * Tool definition for declarative tool registration.
 */
export interface ToolDef {
  desc: string;
  paramsSchema: z.ZodTypeAny;
  examples?: Tool['examples'];
}

type ToolDefs = Record<string, ToolDef>;

/**
 * Component state base interface for persistence
 */
export interface ComponentStateBase {
  version: number;
  updatedAt: number;
}

/**
 * Result of an export operation
 */
export interface ExportResult<T = unknown> {
  data: T;
  format: string;
  metadata?: Record<string, unknown>;
}

/**
 * Options for export operations
 */
export interface ExportOptions {
  format?: string;
  filter?: Record<string, unknown>;
  params?: Record<string, unknown>;
}

/**
 * ToolComponent - Base class for components that provide tools.
 *
 * Features:
 * - **valtio reactive state** via `initialState()` / `reactive` / `snapshot`
 * - **Auto-dispatch** - tool calls route to `on<ToolName>()` methods by convention
 * - **Declarative tools** - `toolDefs()` replaces verbose `new Map()` construction
 * - **Built-in export** - `exportData` uses valtio snapshot by default
 * - **State subscription** - `subscribeState()` for side-effect wiring
 *
 * @example
 * ```typescript
 * class BookViewer extends ToolComponent<{
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
export abstract class ToolComponent<
  TState extends Record<string, any> = Record<string, any>,
> {
  private readonly _reactive = proxy<TState>(this.initialState());
  private _unsubscribers: (() => void)[] = [];

  /** Unique identifier (default: class name) */
  readonly componentId: string = this.constructor.name;

  /** Display name for UI (default: componentId) */
  readonly displayName: string = this.constructor.name;

  /** Description (default: empty string) */
  readonly description: string = '';

  /**
   * Component-level prompt injected into system prompt.
   */
  abstract componentPrompt: string;

  // ==================== Reactive State ====================

  /**
   * Define initial reactive state. Override in subclass.
   */
  protected initialState(): TState {
    return {} as TState;
  }

  /** Write reactive state (mutations are tracked by valtio). */
  protected get reactive(): TState {
    return this._reactive;
  }

  /** Read a frozen snapshot of reactive state. */
  protected get snapshot(): TState {
    return takeSnapshot(this._reactive) as TState;
  }

  /**
   * Subscribe to state changes. Auto-cleanup on deactivate.
   * @returns Unsubscribe function
   */
  protected subscribeState(callback: () => void): () => void {
    const unsub = subscribe(this._reactive, callback);
    this._unsubscribers.push(unsub);
    return unsub;
  }

  // ==================== Declarative Tools ====================

  /**
   * Define tools as a plain object. Override in subclass.
   * Auto-converted to `Map<string, Tool>` via the `toolSet` getter.
   */
  protected toolDefs(): ToolDefs {
    return {};
  }

  /**
   * Map of tool names to tool definitions (auto-built from `toolDefs()`).
   * For advanced use cases, override this getter directly.
   */
  get toolSet(): Map<string, Tool> {
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

  // ==================== Auto-Dispatch ====================

  /**
   * Handle tool call - auto-routes to `on<ToolName>()` methods.
   *
   * For advanced use cases (e.g. typed overloads), override this directly.
   */
  handleToolCall = async (
    toolName: string,
    params: any,
  ): Promise<ToolCallResult<any>> => {
    const handlerName =
      'on' + toolName.charAt(0).toUpperCase() + toolName.slice(1);
    const handler = (this as any)[handlerName];
    if (typeof handler !== 'function') {
      return {
        success: false,
        data: { error: `Unknown tool: ${toolName}` },
        summary: `[${this.componentId}] Unknown tool: ${toolName}`,
      };
    }
    return handler.call(this, params);
  };

  // ==================== Lifecycle ====================

  /** Optional hook called when component is activated by a skill */
  onActivate = async (): Promise<void> => {
    this._unsubscribers = [];
  };

  /** Optional hook called when component is deactivated by a skill */
  onDeactivate = async (): Promise<void> => {
    for (const unsub of this._unsubscribers) {
      unsub();
    }
    this._unsubscribers = [];
  };

  // ==================== Rendering ====================

  /** Render component content. Override in subclass. */
  abstract renderImply: () => Promise<TUIElement[]>;

  /**
   * Render component as a UI element (wraps renderImply in MdDiv or tdiv).
   */
  async render(): Promise<TUIElement | MdElement> {
    const body = await this.renderImply();

    if (body.length > 0 && body[0] instanceof MdElement) {
      const mdChildren = body as any as MdElement[];
      return new MdDiv({ styles: { showBorder: true } }, mdChildren);
    }

    const container = new tdiv({ styles: { showBorder: true } }, body);
    return container;
  }

  /**
   * Render tool section for this component.
   */
  renderToolSection() {
    const tools: Tool[] = [];
    this.toolSet.forEach((value: Tool) => tools.push(value));
    return renderToolSection(tools);
  }

  // ==================== Persistence ====================

  /**
   * Export state for persistence (includes reactive state snapshot).
   */
  exportState(): ComponentStateBase {
    return {
      version: 1,
      updatedAt: Date.now(),
      ...(takeSnapshot(this._reactive) as Record<string, unknown>),
    };
  }

  /**
   * Restore state from persistence.
   */
  restoreState(state: ComponentStateBase): void {
    const keys = Object.keys(this.initialState());
    const saved = Object.fromEntries(
      keys.filter((k) => k in state).map((k) => [k, (state as any)[k]]),
    );
    if (Object.keys(saved).length > 0) {
      Object.assign(this._reactive, saved);
    }
  }

  /**
   * Export component data. Default implementation uses valtio snapshot.
   * Override for custom export logic.
   */
  async exportData(options?: ExportOptions): Promise<ExportResult> {
    return {
      data: takeSnapshot(this._reactive),
      format: options?.format ?? 'json',
      metadata: {
        componentId: this.componentId,
        exportedAt: new Date().toISOString(),
      },
    };
  }

  // ==================== Legacy ====================

  /**
   * @deprecated Use constructor injection with @inject() decorator instead
   * @internal
   */
  _injectDependencies(_container: Container): void {}

  /**
   * @deprecated Use reactive state via initialState()/reactive/snapshot instead
   */
  getState(): any {
    return {};
  }

  /**
   * @deprecated Use reactive state via initialState()/reactive/snapshot instead
   */
  setState(_state: any): void {}
}
