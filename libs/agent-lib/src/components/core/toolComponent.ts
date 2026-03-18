import { injectable } from 'inversify';
import { renderToolSection } from '../utils/toolRendering.js';
import { Tool, ToolCallResult } from './types.js';
import { tdiv } from '../ui/tdiv.js';
import { TUIElement } from '../ui/TUIElement.js';
import { MdDiv } from '../ui/markdown/MdDiv.js';
import { MdElement } from '../ui/markdown/MdElement.js';

/**
 * ToolComponent - Abstract base class for components that provide tools
 *
 * Components can be managed by Skills, which control their lifecycle
 * and tool availability. Components can define their own state, lifecycle hooks,
 * and rendering logic.
 *
 * @note This class is decorated with @injectable() for InversifyJS IoC integration.
 * Components can be resolved via DI container using their TYPE symbols from di/types.ts.
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

    /** Abstract method to render component content */
    abstract renderImply: () => Promise<TUIElement[]>;

    /**
     * Handle tool call and return result with optional custom summary
     * @param toolName - The name of the tool to execute
     * @param params - The parameters passed to the tool
     * @returns ToolCallResult containing the result data and optional custom summary for LOG section
     */
    abstract handleToolCall: (toolName: string, params: any) => Promise<ToolCallResult<any>>;

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
        const container = new tdiv({
            styles: { showBorder: true },
        }, body);

        return container;
    }
}
