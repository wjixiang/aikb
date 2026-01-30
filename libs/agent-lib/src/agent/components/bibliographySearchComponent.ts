import { State, StatefulComponent } from 'statefulContext'

export class BibliographySearchComponent extends StatefulComponent {
    protected override states: Record<string, State> = {

    }
    constructor() {
        super()
    }
    protected override init(): Promise<void> {
        throw new Error('Method not implemented.');
    }

}