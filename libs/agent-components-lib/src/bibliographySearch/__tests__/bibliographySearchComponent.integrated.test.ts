import { config } from 'dotenv'
config()

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { BibliographySearchComponent } from '../bibliographySearchComponent.js'
import { searchPubmedParamsType } from '../bibliographySearchSchemas.js'
import type { ArticleProfile, ArticleDetail } from 'bibliography-search'

describe(BibliographySearchComponent, () => {
    let component: BibliographySearchComponent

    beforeEach(() => {
        component = new BibliographySearchComponent()
    })

    afterEach(() => {
        // Clean up after each test
        component.handleToolCall('clear_results', {})
    })

    describe('E2E: PubMed Search Integration', () => {
        it('should perform a real PubMed search with simple term', async () => {
            const params: searchPubmedParamsType = {
                term: 'hypertension',
                page: 1
            }

            await component.handleToolCall('search_pubmed', params)

            // Verify search results were populated
            expect(component.currentResults).not.toBeNull()
            expect(component.currentResults!.totalResults).toBeGreaterThan(0)
            expect(component.currentResults!.articleProfiles).toBeDefined()
            expect(component.currentResults!.articleProfiles.length).toBeGreaterThan(0)

            // Verify search parameters were stored
            expect(component.currentSearchParams).not.toBeNull()
            expect(component.currentSearchParams!.term).toBe('hypertension')
            expect(component.currentPage).toBe(1)
        }, 15000)

        it('should perform PubMed search with sort options', async () => {
            const params: searchPubmedParamsType = {
                term: 'diabetes',
                sort: 'date',
                sortOrder: 'dsc',
                page: 1
            }

            await component.handleToolCall('search_pubmed', params)

            expect(component.currentResults).not.toBeNull()
            expect(component.currentResults!.articleProfiles.length).toBeGreaterThan(0)
            expect(component.currentSearchParams!.sort).toBe('date')
            expect(component.currentSearchParams!.sortOrder).toBe('dsc')
        }, 15000)

        it('should perform PubMed search with filters', async () => {
            const params: searchPubmedParamsType = {
                term: 'cancer',
                filter: ['Meta-Analysis', 'Systematic Review'],
                page: 1
            }

            await component.handleToolCall('search_pubmed', params)

            expect(component.currentResults).not.toBeNull()
            expect(component.currentResults!.totalResults).toBeGreaterThan(0)
            expect(component.currentSearchParams!.filter).toEqual(['Meta-Analysis', 'Systematic Review'])
        }, 15000)

        it('should handle search with no results gracefully', async () => {
            const params: searchPubmedParamsType = {
                term: 'xyzabc123nonexistentterm',
                page: 1
            }

            await component.handleToolCall('search_pubmed', params)

            // Should still have results object, but with zero articles
            expect(component.currentResults).not.toBeNull()
            expect(component.currentResults!.articleProfiles).toBeDefined()
            expect(component.currentResults!.articleProfiles.length).toBe(0)
        }, 15000)
    })

    describe('E2E: Article Detail Retrieval', () => {
        it('should retrieve article details for a valid PMID', async () => {
            // First, perform a search to get a valid PMID
            const searchParams: searchPubmedParamsType = {
                term: 'hypertension',
                page: 1
            }
            await component.handleToolCall('search_pubmed', searchParams)

            // Get the PMID from the first article
            const firstArticle = component.currentResults!.articleProfiles[0]
            const pmid = firstArticle.pmid

            // Retrieve article details
            const result = await component.handleToolCall('view_article', { pmid })

            // Verify article details were retrieved (check result.data.error)
            expect(result.data.error).toBeUndefined()
            expect(component.currentArticleDetail).not.toBeNull()
            expect(component.currentArticleDetail!.pmid).toBe(pmid)
            expect(component.currentArticleDetail!.title).toBeDefined()
            expect(component.currentArticleDetail!.authors).toBeDefined()
            expect(component.currentArticleDetail!.abstract).toBeDefined()
        }, 15000)

        it('should return error for invalid PMID', async () => {
            const result = await component.handleToolCall('view_article', { pmid: '00000000' })
            expect(result.data.error).toBeDefined()
        })

        it('should return error when PMID is not provided', async () => {
            const result = await component.handleToolCall('view_article', {})
            expect(result.data.error).toBe('PMID is required')
        })
    })

    describe('E2E: Pagination Navigation', () => {
        it('should navigate to next page', async () => {
            // Perform initial search
            const searchParams: searchPubmedParamsType = {
                term: 'cancer',
                page: 1
            }
            await component.handleToolCall('search_pubmed', searchParams)

            const firstPageResults = component.currentResults!.articleProfiles

            // Navigate to next page
            await component.handleToolCall('navigate_page', { direction: 'next' })

            // Verify page changed
            expect(component.currentPage).toBe(2)
            expect(component.currentResults).not.toBeNull()

            // Results should be different (or at least different position)
            const secondPageResults = component.currentResults!.articleProfiles
            expect(secondPageResults).toBeDefined()
        }, 15000)

        it('should navigate to previous page', async () => {
            // Start from page 2
            const searchParams: searchPubmedParamsType = {
                term: 'diabetes',
                page: 2
            }
            await component.handleToolCall('search_pubmed', searchParams)

            // Navigate to previous page
            await component.handleToolCall('navigate_page', { direction: 'prev' })

            // Verify page changed
            expect(component.currentPage).toBe(1)
        }, 15000)

        it('should return error when navigating next on last page', async () => {
            // Search with a specific term that has limited results
            const searchParams: searchPubmedParamsType = {
                term: 'xyzabc123nonexistentterm',
                page: 1
            }
            await component.handleToolCall('search_pubmed', searchParams)

            // Try to navigate next (should return error since no results)
            const result = await component.handleToolCall('navigate_page', { direction: 'next' })
            expect(result.data.error).toBeDefined()
        })

        it('should return error when navigating prev on first page', async () => {
            const searchParams: searchPubmedParamsType = {
                term: 'hypertension',
                page: 1
            }
            await component.handleToolCall('search_pubmed', searchParams)

            // Try to navigate previous from page 1
            const result = await component.handleToolCall('navigate_page', { direction: 'prev' })
            expect(result.data.error).toBe('Already on the first page')
        })

        it('should return error when navigating without search results', async () => {
            // Try to navigate without performing a search first
            const result = await component.handleToolCall('navigate_page', { direction: 'next' })
            expect(result.data.error).toBe('No search results to navigate')
        })
    })

    describe('E2E: Clear Results', () => {
        it('should clear all search results and article details', async () => {
            // Perform search
            const searchParams: searchPubmedParamsType = {
                term: 'hypertension',
                page: 1
            }
            await component.handleToolCall('search_pubmed', searchParams)

            // View an article
            const pmid = component.currentResults!.articleProfiles[0].pmid
            await component.handleToolCall('view_article', { pmid })

            // Verify data exists
            expect(component.currentResults).not.toBeNull()
            expect(component.currentArticleDetail).not.toBeNull()
            expect(component.currentSearchParams).not.toBeNull()
            expect(component.currentPage).toBe(1)

            // Clear results
            await component.handleToolCall('clear_results', {})

            // Verify all data was cleared
            expect(component.currentResults).toBeNull()
            expect(component.currentArticleDetail).toBeNull()
            expect(component.currentSearchParams).toBeNull()
            expect(component.currentRetrivalStrategy).toBeNull()
            expect(component.currentPage).toBe(1)
        }, 15000)
    })

    describe('E2E: Rendering Integration', () => {
        it('should render welcome message when no results', async () => {
            const elements = await component.render()
            const rendered = elements.render()

            expect(rendered).toContain('Bibliography Search')
            expect(rendered).toContain('Welcome to Bibliography Search')
        })

        it('should render search results after search', async () => {
            const searchParams: searchPubmedParamsType = {
                term: 'hypertension',
                page: 1
            }
            await component.handleToolCall('search_pubmed', searchParams)

            const elements = await component.render()
            const rendered = elements.render()

            expect(rendered).toContain('Search Result')
            expect(rendered).toContain('Found')
            expect(rendered).toContain('articles')
        }, 15000)

        it('should render article detail when viewing article', async () => {
            // Perform search
            const searchParams: searchPubmedParamsType = {
                term: 'hypertension',
                page: 1
            }
            await component.handleToolCall('search_pubmed', searchParams)

            // View article
            const pmid = component.currentResults!.articleProfiles[0].pmid
            await component.handleToolCall('view_article', { pmid })

            const elements = await component.render()
            const rendered = elements.render()

            expect(rendered).toContain('Article Detail')
            expect(rendered).toContain('PMID:')
            expect(rendered).toContain('Authors:')
        }, 15000)
    })

    describe('E2E: Error Handling', () => {
        it('should handle search with missing term', async () => {
            const result = await component.handleToolCall('search_pubmed', {})
            expect(result.data.error).toBe('term must be provided')
        })

        it('should handle invalid tool name', async () => {
            const result = await component.handleToolCall('invalid_tool', {})
            expect(result.data.error).toBe('Unknown tool: invalid_tool')
        })
    })

    describe('E2E: Complete Workflow', () => {
        it('should complete full search, view, and navigate workflow', async () => {
            // Step 1: Search for articles
            const searchParams: searchPubmedParamsType = {
                term: 'cardiovascular disease',
                page: 1
            }
            await component.handleToolCall('search_pubmed', searchParams)

            expect(component.currentResults).not.toBeNull()
            expect(component.currentResults!.articleProfiles.length).toBeGreaterThan(0)

            // Step 2: View first article details
            const firstPMID = component.currentResults!.articleProfiles[0].pmid
            await component.handleToolCall('view_article', { pmid: firstPMID })

            expect(component.currentArticleDetail).not.toBeNull()
            expect(component.currentArticleDetail!.pmid).toBe(firstPMID)

            // Step 3: Clear and search again
            await component.handleToolCall('clear_results', {})
            expect(component.currentResults).toBeNull()

            // Step 4: New search
            const newSearchParams: searchPubmedParamsType = {
                term: 'diabetes mellitus',
                sort: 'date',
                sortOrder: 'dsc',
                page: 1
            }
            await component.handleToolCall('search_pubmed', newSearchParams)

            expect(component.currentResults).not.toBeNull()
            expect(component.currentSearchParams!.term).toBe('diabetes mellitus')

            // Step 5: Navigate pages if available
            if (component.currentResults!.totalPages && component.currentResults!.totalPages > 1) {
                await component.handleToolCall('navigate_page', { direction: 'next' })
                expect(component.currentPage).toBe(2)
            }
        }, 30000)
    })
})
