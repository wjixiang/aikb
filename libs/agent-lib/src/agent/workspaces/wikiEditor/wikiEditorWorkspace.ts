import { WorkspaceBase } from "../../agentWorkspace";
import { WikiEditorComponents } from "./wikiEditorComponents";

export class WikiEditorWorkspace extends WorkspaceBase {
    constructor() {
        super({
            name: "Wiki Editor Workspace",
            desc: ""
        })
    }
    override async init(): Promise<void> {
        // Register all components
        await Promise.all([
            this.componentRegistry.register(new WikiEditorComponents()),
        ]);

        this.initialized = true;
    }


    override async getWorkspacePrompt(): Promise<string> {
        return ''
    }

}