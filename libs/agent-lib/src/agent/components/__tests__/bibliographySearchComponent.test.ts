import { readFileSync, writeFileSync } from 'fs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BibliographySearchComponent } from '../bibliographySearchComponent';

import { searchPubmedParamsType } from '../bibliographySearchSchemas';

describe(BibliographySearchComponent, () => {
    let component: BibliographySearchComponent
    beforeEach(() => {
        component = new BibliographySearchComponent()
    })

    it('should render into proper context', async () => {
        const renderResult = (await component.render()).render()
        console.debug(renderResult)
    })

    // it('should perform bibliographic searching request', async () => {
    //     const params: searchPubmedParamsType = {
    //         simpleTerm: 'hypertension'
    //     }
    //     await component.handleToolCall('search_pubmed', params)
    //     const renderResult = (await component.render()).render()
    //     console.log(component.currentResults)
    //     writeFileSync(__dirname + '/searchResult.json', JSON.stringify(component.currentResults))
    //     // console.debug(renderResult)
    // })

    it('should load search results from file', async () => {
        const mockResults = JSON.parse(readFileSync(__dirname + '/searchResult.json').toString())

        component.currentResults = mockResults
        // expect(component.currentResults).toEqual(mockResults)
        // expect(component.currentResults?.totalResults).toBe(703696)
        // console.log((await component.render()).render())
        const renderedSearchResult = component.renderSearchResults().render()
        console.log(renderedSearchResult)
    })
})