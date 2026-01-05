import { Agent } from "../agent";
import { BookshelfWorkspace } from "../bookshelfWorkspace";

export class MedTextBookExpert extends Agent {
    constructor() {
        super(
            undefined,
            undefined,
            new BookshelfWorkspace()
        )
    }


}