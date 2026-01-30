import { renderToolSection } from "./section/renderToolSection";
import { tdiv, Tool, TUIElement } from "./ui";

export abstract class ToolComponent {
    abstract toolSet: Map<string, Tool>;


    abstract renderImply: () => Promise<TUIElement[]>;
    abstract handleToolCall: (toolName: string, params: any) => Promise<void>;

    renderToolSection() {
        const tools: Tool[] = []
        this.toolSet.forEach((value: Tool) => tools.push(value))
        const toolSection = renderToolSection(tools);
        return toolSection;
    }

    async render(): Promise<TUIElement[]> {
        const container = new tdiv({});

        const body = await this.renderImply();
        body.forEach(e => container.addChild(e));
        return [container]
    }
}