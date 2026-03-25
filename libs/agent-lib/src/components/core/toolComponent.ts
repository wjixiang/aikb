import { injectable, type Container } from 'inversify';
import { renderToolSection } from '../utils/toolRendering.js';
import { Tool, ToolCallResult } from './types.js';
import { tdiv } from '../ui/tdiv.js';
import { TUIElement } from '../ui/TUIElement.js';
import { MdDiv } from '../ui/markdown/MdDiv.js';
import { MdElement } from '../ui/markdown/MdElement.js';

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
  /** Exported data */
  data: T;
  /** Export format used */
  format: string;
  /** Optional metadata about the export */
  metadata?: Record<string, unknown>;
}

/**
 * Options for export operations
 */
export interface ExportOptions {
  /** Target format (e.g., 'json', 'csv', 'xml') */
  format?: string;
  /** Optional filter criteria */
  filter?: Record<string, unknown>;
  /** Additional export parameters */
  params?: Record<string, unknown>;
}

/**
 * ToolComponent - Abstract base class for components that provide tools
 *
 * Components can be managed by Skills, which control their lifecycle
 * and tool availability. Components can define their own state, lifecycle hooks,
 * rendering logic, and custom export functionality.
 *
 * @note This class is decorated with @injectable() for InversifyJS IoC integration.
 * Components can use standard @inject() decorator in their constructors for DI.
 *
 * ## Dependency Injection
 *
 * Components can use standard @inject() decorator in constructor:
 * ```typescript
 * class MyComponent extends ToolComponent {
 *   private a2aHandler: IA2AHandler;
 *
 *   constructor(
 *     @inject(TYPES.IA2AHandler) a2aHandler: IA2AHandler,
 *   ) {
 *     super();
 *     this.a2aHandler = a2aHandler;
 *   }
 * }
 * ```
 */
@injectable()
export abstract class ToolComponent {
  /** Map of tool names to tool definitions */
  abstract toolSet: Map<string, Tool>;

  /** Unique identifier for this component (default: class name) */
  readonly componentId: string = this.constructor.name;

  /** Display name for UI (default: componentId) */
  readonly displayName: string = this.constructor.name;

  /** Description of what this component does (default: empty string) */
  readonly description: string = '';

  /**
   * Component-level prompt injected into system prompt (optional)
   * Use this to provide component-specific context, workflows, or guidelines
   * that should be included in the agent's system prompt
   */
  abstract componentPrompt: string;

  // ==================== Centralized State Management (Phase 3) ====================

  /** Centralized state storage */
  protected _state: ComponentStateBase = {
    version: 1,
    updatedAt: Date.now(),
  };

  /** State change callback for persistence */
  onStateChange?: (newState: ComponentStateBase) => void;

  /**
   * Get state (readonly)
   */
  get state(): ComponentStateBase {
    return { ...this._state };
  }

  /**
   * Update state with partial data
   */
  protected updateState(partial: Partial<ComponentStateBase>): void {
    this._state = {
      ...this._state,
      ...partial,
      updatedAt: Date.now(),
    };
    this.onStateChange?.(this._state);
  }

  /**
   * Restore state from persistence (override in subclass)
   */
  restoreState(state: ComponentStateBase): void {
    this._state = { ...state };
  }

  /**
   * Export state for persistence (can override in subclass for custom state)
   */
  exportState(): ComponentStateBase {
    return { ...this._state };
  }

  /**
   * Inject dependencies from DI container
   *
   * @deprecated This method is kept for backward compatibility but is now a no-op.
   * Components should use @inject() decorator in constructor for DI.
   *
   * @param container - The DI container (not used anymore)
   */
  protected injectDependencies(container: Container): void {
    // No-op: Components now use @inject() in constructor
    // This method is kept for backward compatibility
  }

  /**
   * Internal method called by AgentContainer to inject dependencies
   * @deprecated Use constructor injection with @inject() decorator instead
   * @internal
   */
  _injectDependencies(container: Container): void {
    this.injectDependencies(container);
  }

  // ==================== Abstract Methods ====================

  /** Abstract method to render component content */
  abstract renderImply: () => Promise<TUIElement[]>;

  /**
   * Handle tool call and return result with optional custom summary
   * @param toolName - The name of the tool to execute
   * @param params - The parameters passed to the tool
   * @returns ToolCallResult containing the result data and optional custom summary for LOG section
   */
  abstract handleToolCall: (
    toolName: string,
    params: any,
  ) => Promise<ToolCallResult<any>>;

  /** Optional hook called when component is activated by a skill */
  onActivate?: () => Promise<void>;

  /** Optional hook called when component is deactivated by a skill */
  onDeactivate?: () => Promise<void>;

  /**
   * Get component state for serialization
   * @returns Current state of the component
   */
  getState(): any {
    return {};
  }

  /**
   * Set component state from serialized data
   * @param state - State to restore
   */
  setState(state: any): void {
    // Override in subclasses to implement state restoration
  }

  /**
   * Export component data with custom logic
   * @param options - Export options (format, filter, params)
   * @returns ExportResult containing exported data and metadata
   */
  abstract exportData(options?: ExportOptions): Promise<ExportResult>;

  /**
   * Render tool section for this component
   * @returns TUIElement displaying available tools
   */
  renderToolSection() {
    const tools: Tool[] = [];
    this.toolSet.forEach((value: Tool) => tools.push(value));
    const toolSection = renderToolSection(tools);
    return toolSection;
  }

  /**
   * Render component as a UI element
   * @returns TUIElement or MdElement with component content
   */
  async render(): Promise<TUIElement | MdElement> {
    const body = await this.renderImply();

    // Check if body contains MdElements (Markdown mode)
    if (body.length > 0 && body[0] instanceof MdElement) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mdChildren = body as any as MdElement[];
      return new MdDiv({ styles: { showBorder: true } }, mdChildren);
    }

    // Default to TUI rendering
    const container = new tdiv(
      {
        styles: { showBorder: true },
      },
      body,
    );

    return container;
  }
}
