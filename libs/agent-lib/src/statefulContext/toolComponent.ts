import { injectable } from 'inversify';
import { renderToolSection } from "../utils/toolRendering.js";
import { Tool } from "./types.js";
import { tdiv, TUIElement } from "./ui/index.js";

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

    /** Abstract method to handle tool calls */
    abstract handleToolCall: (toolName: string, params: any) => Promise<void>;

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
     * Render component as a TUI element
     * @returns TUIElement with component content
     */
    async render(): Promise<TUIElement> {
        const body = await this.renderImply();
        const container = new tdiv({
            styles: { showBorder: true },
        }, body);

        return container;
    }
}