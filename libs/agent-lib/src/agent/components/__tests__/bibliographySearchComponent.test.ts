import { BibliographySearchComponent } from '../bibliographySearchComponent';

describe(BibliographySearchComponent, () => {
    let component: BibliographySearchComponent
    beforeEach(() => {
        component = new BibliographySearchComponent()
    })

    it('should render into proper context', async () => {
        console.log(await component.render())
    })
})