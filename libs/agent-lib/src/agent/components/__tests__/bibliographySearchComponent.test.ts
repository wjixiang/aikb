import { BibliographySearchComponent } from '../bibliographySearchComponent';

describe(BibliographySearchComponent, () => {
    let component: BibliographySearchComponent
    beforeEach(() => {
        component = new BibliographySearchComponent()
    })

    it('should render into proper context', async () => {
        const renderResult = (await component.render()).render()
        console.debug(renderResult)
    })
})