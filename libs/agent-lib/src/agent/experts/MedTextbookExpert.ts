import { Agent } from "../agent";
import { BookshelfWorkspace } from "../workspaces/bookshelfWorkspace/bookshelfWorkspace";
import { WikiEditorWorkspace } from "../workspaces/wikiEditor/wikiEditorWorkspace";

export class MedTextBookExpert extends Agent {
    constructor() {
        super(
            undefined,
            undefined,
            new BookshelfWorkspace()
        )
    }
}

export class MedResearchExpert extends Agent {
    constructor() {
        super(
            undefined,
            undefined,
            new WikiEditorWorkspace()
        )
    }
}