import { renderToolSection } from "../utils/toolRendering.js";
import { Tool } from "./types.js";
import { tdiv, TUIElement } from "./ui/index.js";

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

    async render(): Promise<TUIElement> {
        const body = await this.renderImply();
        const container = new tdiv({
            styles: { showBorder: true },
        }, body);


        return container
    }
}