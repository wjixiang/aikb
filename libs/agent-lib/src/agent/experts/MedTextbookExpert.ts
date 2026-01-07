import { Agent } from "../agent";
import { BookshelfWorkspace } from "../workspaces/bookshelfWorkspace/bookshelfWorkspace";

export class MedTextBookExpert extends Agent {
    constructor() {
        super(
            undefined,
            undefined,
            new BookshelfWorkspace()
        )
    }
}