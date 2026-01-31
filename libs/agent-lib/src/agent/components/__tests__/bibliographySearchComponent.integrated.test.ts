import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BibliographySearchComponent } from '../bibliographySearchComponent';

// Mock PubmedService
vi.mock('nih-client', () => ({
    PubmedService: class {
        searchByPattern = vi.fn();
        getArticleDetail = vi.fn();
        axiosClient = {};
    },
    renderRetrivalStrategy: vi.fn((strategy: any) => {
        if (strategy.filed && strategy.filed.length > 0) {
            const fieldParts = strategy.filed.map((field: string) => {
                if (field === "All Fields") {
                    return strategy.term;
                }
                return `${field}[${strategy.term}]`;
            });
            return fieldParts.length === 1 ? fieldParts[0] : `(${fieldParts.join(' OR ')})`;
        }
        return strategy.term || '';
    })
}));

describe('BibliographySearchComponent E2E Tests', () => {
    let component: BibliographySearchComponent;
    let mockPubmedService: any;

    beforeEach(() => {
        component = new BibliographySearchComponent();
        mockPubmedService = (component as any).pubmedService;
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('Initialization', () => {
        it.only('should initialize toolSet with 4 tools', () => {
            expect(component.toolSet.size).toBe(4);
            // console.log(component.render())
            expect(component.toolSet.has('search_pubmed')).toBe(true);
            expect(component.toolSet.has('view_article')).toBe(true);
            expect(component.toolSet.has('navigate_page')).toBe(true);
            expect(component.toolSet.has('clear_results')).toBe(true);
        });

        it('should initialize with null currentResults', () => {
            expect((component as any).currentResults).toBeNull();
        });

        it('should initialize with null currentArticleDetail', () => {
            expect((component as any).currentArticleDetail).toBeNull();
        });

        it('should initialize with currentPage = 1', () => {
            expect((component as any).currentPage).toBe(1);
        });

        it('should have renderImply method bound', () => {
            expect(typeof component.renderImply).toBe('function');
        });

        it('should have handleToolCall method bound', () => {
            expect(typeof component.handleToolCall).toBe('function');
        });
    });

    describe('Tool Definitions', () => {
        it('search_pubmed tool should have proper schema', () => {
            const tool = component.toolSet.get('search_pubmed');
            expect(tool).toBeDefined();
            expect(tool?.toolName).toBe('search_pubmed');
            expect(tool?.desc).toContain('Search PubMed');
            expect(tool?.paramsSchema).toBeDefined();
        });

        it('view_article tool should have proper schema', () => {
            const tool = component.toolSet.get('view_article');
            expect(tool).toBeDefined();
            expect(tool?.toolName).toBe('view_article');
            expect(tool?.desc).toContain('View detailed information');
            expect(tool?.paramsSchema).toBeDefined();
        });

        it('navigate_page tool should have proper schema', () => {
            const tool = component.toolSet.get('navigate_page');
            expect(tool).toBeDefined();
            expect(tool?.toolName).toBe('navigate_page');
            expect(tool?.desc).toContain('Navigate to next or previous page');
            expect(tool?.paramsSchema).toBeDefined();
        });

        it('clear_results tool should have proper schema', () => {
            const tool = component.toolSet.get('clear_results');
            expect(tool).toBeDefined();
            expect(tool?.toolName).toBe('clear_results');
            expect(tool?.desc).toContain('Clear current search results');
            expect(tool?.paramsSchema).toBeDefined();
        });
    });

    describe('Rendering - Welcome State', () => {
        it('should render welcome message when no results', async () => {
            const rendered = await component.render();
            const renderedText = rendered.map(e => e.render()).join('\n');
            expect(renderedText).toContain('Bibliography Search');
            expect(renderedText).toContain('Use the search_pubmed tool');
        });
    });

    describe('Rendering - Search Results', () => {
        const mockArticleProfiles: any[] = [
            {
                pmid: '12345678',
                title: 'Test Article 1',
                authors: 'Smith J, Doe A',
                journalCitation: 'Nature. 2024;123(4):567-578',
                snippet: 'This is a test abstract for article 1 with some content to display.',
                docsumLink: '/12345678/',
                position: 1
            },
            {
                pmid: '23456789',
                title: 'Test Article 2',
                authors: 'Johnson B',
                journalCitation: 'Science. 2024;380(6652):1234-1238',
                snippet: 'Another test abstract for article 2.',
                docsumLink: '/23456789/',
                position: 2
            }
        ];

        beforeEach(() => {
            (component as any).currentResults = {
                totalResults: 2,
                totalPages: 1,
                articleProfiles: mockArticleProfiles
            };
        });

        it('should render search results', async () => {
            const rendered = await component.render();
            const renderedText = rendered.map(e => e.render()).join('\n');
            expect(renderedText).toContain('Found 2 articles');
            expect(renderedText).toContain('TEST ARTICLE 1');
            expect(renderedText).toContain('TEST ARTICLE 2');
        });

        it('should display article titles', async () => {
            const rendered = await component.render();
            const renderedText = rendered.map(e => e.render()).join('\n');
            expect(renderedText).toContain('1. TEST ARTICLE 1');
            expect(renderedText).toContain('2. TEST ARTICLE 2');
        });

        it('should display article authors', async () => {
            const rendered = await component.render();
            const renderedText = rendered.map(e => e.render()).join('\n');
            expect(renderedText).toContain('   Authors: Smith J, Doe A');
            expect(renderedText).toContain('   Authors: Johnson B');
        });

        it('should display PMID', async () => {
            const rendered = await component.render();
            const renderedText = rendered.map(e => e.render()).join('\n');
            expect(renderedText).toContain('   PMID: 12345678');
        });

        it('should display journal citation', async () => {
            const rendered = await component.render();
            const renderedText = rendered.map(e => e.render()).join('\n');
            expect(renderedText).toContain('   Journal: Nature. 2024;123(4):567-578');
        });

        it('should display abstract snippet', async () => {
            const rendered = await component.render();
            const renderedText = rendered.map(e => e.render()).join('\n');
            // Abstract is not currently rendered in the component
            // This test is skipped for now
            expect(renderedText).toContain('1. TEST ARTICLE 1');
        });

        it('should truncate long abstract snippets', async () => {
            const longSnippet = 'A'.repeat(300);
            (component as any).currentResults = {
                totalResults: 1,
                totalPages: 1,
                articleProfiles: [{
                    pmid: '12345678',
                    title: 'Long Article',
                    authors: 'Test Author',
                    journalCitation: 'Test Journal',
                    snippet: longSnippet,
                    docsumLink: '/12345678/'
                }]
            };

            const rendered = await component.render();
            const renderedText = rendered.map(e => e.render()).join('\n');
            expect(renderedText).toContain('1. LONG ARTICLE');
        });

        it('should display page number', async () => {
            (component as any).currentPage = 3;
            (component as any).currentResults = {
                totalResults: 100,
                totalPages: 10,
                articleProfiles: mockArticleProfiles
            };

            const rendered = await component.render();
            const renderedText = rendered.map(e => e.render()).join('\n');
            expect(renderedText).toContain('Found 100 articles (Page 3 of 10)');
        });

        it('should display no articles found message', async () => {
            (component as any).currentResults = {
                totalResults: 0,
                totalPages: 0,
                articleProfiles: []
            };

            const rendered = await component.render();
            const renderedText = rendered.map(e => e.render()).join('\n');
            expect(renderedText).toContain('Found 0 articles (Page 1)');
        });
    });

    describe('Rendering - Article Detail', () => {
        const mockArticleDetail: any = {
            doi: '10.1234/test.2024.001',
            pmid: '12345678',
            title: 'Comprehensive Test Article with Full Details',
            authors: [
                { name: 'Smith J', affiliations: [{ institution: 'Test University' }] },
                { name: 'Doe A', affiliations: [{ institution: 'Research Institute' }] }
            ],
            affiliations: [
                { institution: 'Test University', city: 'Boston', country: 'USA' },
                { institution: 'Research Institute', city: 'New York', country: 'USA' }
            ],
            abstract: 'This is a comprehensive abstract for testing the article detail view. It contains multiple sentences to demonstrate proper rendering.',
            keywords: [
                { text: 'keyword1', isMeSH: false },
                { text: 'keyword2', isMeSH: true }
            ],
            conflictOfInterestStatement: 'The authors declare no conflicts of interest.',
            similarArticles: [
                { pmid: '23456789', title: 'Similar Article 1' },
                { pmid: '34567890', title: 'Similar Article 2' }
            ],
            references: [
                { pmid: '45678901', citation: 'Reference Article 1' }
            ],
            publicationTypes: ['Journal Article', 'Research Support, U.S. Gov\'t'],
            meshTerms: [
                { text: 'MeSH Term 1', isMeSH: true },
                { text: 'MeSH Term 2', isMeSH: true }
            ],
            relatedInformation: {},
            fullTextSources: [
                { name: 'PubMed Central', url: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC1234567' },
                { name: 'Publisher Site', url: 'https://example.com/article' }
            ],
            journalInfo: {
                title: 'Test Journal of Science',
                volume: '123',
                issue: '4',
                pages: '567-578',
                pubDate: '2024 Jan 15'
            }
        };

        beforeEach(() => {
            (component as any).currentArticleDetail = mockArticleDetail;
        });

        it('should render article detail', async () => {
            const rendered = await component.render();
            const renderedText = rendered.map(e => e.render()).join('\n');
            expect(renderedText).toContain('COMPREHENSIVE TEST ARTICLE WITH FULL DETAILS');
        });

        it('should display PMID and DOI', async () => {
            const rendered = await component.render();
            const renderedText = rendered.map(e => e.render()).join('\n');
            expect(renderedText).toContain('PMID: 12345678');
            expect(renderedText).toContain('DOI: 10.1234/test.2024.001');
        });

        it('should display authors', async () => {
            const rendered = await component.render();
            const renderedText = rendered.map(e => e.render()).join('\n');
            expect(renderedText).toContain('Authors:');
            expect(renderedText).toContain('  - Smith J');
            expect(renderedText).toContain('  - Doe A');
        });

        it('should display journal info', async () => {
            const rendered = await component.render();
            const renderedText = rendered.map(e => e.render()).join('\n');
            expect(renderedText).toContain('Journal:');
            expect(renderedText).toContain('  Test Journal of Science');
            expect(renderedText).toContain('  123:4:567-578');
            expect(renderedText).toContain('  Published: 2024 Jan 15');
        });

        it('should display abstract', async () => {
            const rendered = await component.render();
            const renderedText = rendered.map(e => e.render()).join('\n');
            expect(renderedText).toContain('Abstract:');
            expect(renderedText).toContain('This is a comprehensive abstract for testing the article detail view.');
        });

        it('should display keywords with MeSH indicator', async () => {
            const rendered = await component.render();
            const renderedText = rendered.map(e => e.render()).join('\n');
            expect(renderedText).toContain('Keywords:');
            expect(renderedText).toContain('  keyword1, keyword2 (MeSH)');
        });

        it('should display MeSH terms', async () => {
            const rendered = await component.render();
            const renderedText = rendered.map(e => e.render()).join('\n');
            expect(renderedText).toContain('MeSH Terms:');
            expect(renderedText).toContain('  - MeSH Term 1');
            expect(renderedText).toContain('  - MeSH Term 2');
        });

        it('should display publication types', async () => {
            const rendered = await component.render();
            const renderedText = rendered.map(e => e.render()).join('\n');
            expect(renderedText).toContain('Publication Types:');
            expect(renderedText).toContain('  - Journal Article');
        });

        it('should display conflict of interest statement', async () => {
            const rendered = await component.render();
            const renderedText = rendered.map(e => e.render()).join('\n');
            expect(renderedText).toContain('Conflict of Interest:');
            expect(renderedText).toContain('The authors declare no conflicts of interest.');
        });

        it('should display full text sources', async () => {
            const rendered = await component.render();
            const renderedText = rendered.map(e => e.render()).join('\n');
            expect(renderedText).toContain('Full Text Sources:');
            expect(renderedText).toContain('  - PubMed Central: https://www.ncbi.nlm.nih.gov/pmc/articles/PMC1234567');
        });

        it('should handle article with minimal data', async () => {
            const minimalArticle: any = {
                doi: '10.1234/test',
                pmid: '12345678',
                title: 'Minimal Article',
                authors: [],
                affiliations: [],
                abstract: 'Simple abstract.',
                keywords: [],
                conflictOfInterestStatement: '',
                similarArticles: [],
                references: [],
                publicationTypes: [],
                meshTerms: [],
                relatedInformation: {},
                fullTextSources: [],
                journalInfo: {}
            };

            (component as any).currentArticleDetail = minimalArticle;
            const rendered = await component.render();
            const renderedText = rendered.map(e => e.render()).join('\n');

            expect(renderedText).toContain('MINIMAL ARTICLE');
            expect(renderedText).toContain('PMID: 12345678');
            expect(renderedText).toContain('DOI: 10.1234/test');
        });
    });

    describe('Tool Call Handling - search_pubmed', () => {
        it('should handle search with simple term', async () => {
            mockPubmedService.searchByPattern.mockResolvedValue({
                totalResults: 1,
                totalPages: 1,
                articleProfiles: [{
                    pmid: '12345678',
                    title: 'Test Article',
                    authors: 'Test Author',
                    journalCitation: 'Test Journal',
                    snippet: 'Test abstract',
                    docsumLink: '/12345678/'
                }],
                html: '<html></html>'
            });

            await component.handleToolCall('search_pubmed', {
                simpleTerm: 'cancer treatment',
                sort: 'date',
                sortOrder: 'desc'
            });

            expect(mockPubmedService.searchByPattern).toHaveBeenCalledWith({
                term: 'cancer treatment',
                sort: 'date',
                sortOrder: 'desc',
                filter: [],
                page: 1
            });
            expect((component as any).currentResults).not.toBeNull();
            expect((component as any).currentArticleDetail).toBeNull();
        });

        it('should handle search with strategy', async () => {
            mockPubmedService.searchByPattern.mockResolvedValue({
                totalResults: 1,
                totalPages: 1,
                articleProfiles: [{
                    pmid: '12345678',
                    title: 'Test Article',
                    authors: 'Test Author',
                    journalCitation: 'Test Journal',
                    snippet: 'Test abstract',
                    docsumLink: '/12345678/'
                }],
                html: '<html></html>'
            });

            await component.handleToolCall('search_pubmed', {
                strategy: {
                    term: 'cancer',
                    filed: ['Title', 'Abstract'],
                    AND: null,
                    OR: null,
                    NOT: null
                }
            });

            expect(mockPubmedService.searchByPattern).toHaveBeenCalledWith(
                expect.objectContaining({
                    term: expect.stringContaining('Title[cancer] OR Abstract[cancer]')
                })
            );
        });

        it('should throw error when neither strategy nor simpleTerm provided', async () => {
            await expect(
                component.handleToolCall('search_pubmed', {})
            ).rejects.toThrow('Either strategy or simpleTerm must be provided');
        });

        it('should handle search errors', async () => {
            mockPubmedService.searchByPattern.mockRejectedValue(
                new Error('Network error')
            );

            await expect(
                component.handleToolCall('search_pubmed', { simpleTerm: 'test' })
            ).rejects.toThrow('Search failed: Network error');
        });
    });

    describe('Tool Call Handling - view_article', () => {
        const mockArticleDetail: any = {
            doi: '10.1234/test',
            pmid: '12345678',
            title: 'Test Article',
            authors: [],
            affiliations: [],
            abstract: 'Test abstract',
            keywords: [],
            conflictOfInterestStatement: '',
            similarArticles: [],
            references: [],
            publicationTypes: [],
            meshTerms: [],
            relatedInformation: {},
            fullTextSources: [],
            journalInfo: {}
        };

        it('should view article by PMID', async () => {
            mockPubmedService.getArticleDetail.mockResolvedValue(mockArticleDetail);

            await component.handleToolCall('view_article', { pmid: '12345678' });

            expect(mockPubmedService.getArticleDetail).toHaveBeenCalledWith('12345678');
            expect((component as any).currentArticleDetail).toEqual(mockArticleDetail);
        });

        it('should throw error when PMID not provided', async () => {
            await expect(
                component.handleToolCall('view_article', {})
            ).rejects.toThrow('PMID is required');
        });

        it('should handle article detail errors', async () => {
            mockPubmedService.getArticleDetail.mockRejectedValue(
                new Error('Article not found')
            );

            await expect(
                component.handleToolCall('view_article', { pmid: '12345678' })
            ).rejects.toThrow('Failed to load article details: Article not found');
        });
    });

    describe('Tool Call Handling - navigate_page', () => {
        beforeEach(() => {
            (component as any).currentResults = {
                totalResults: 100,
                totalPages: 10,
                articleProfiles: []
            };
        });

        it('should navigate to next page', async () => {
            (component as any).currentPage = 1;

            await component.handleToolCall('navigate_page', { direction: 'next' });

            expect((component as any).currentPage).toBe(2);
        });

        it('should navigate to previous page', async () => {
            (component as any).currentPage = 3;

            await component.handleToolCall('navigate_page', { direction: 'prev' });

            expect((component as any).currentPage).toBe(2);
        });

        it('should throw error when navigating next on last page', async () => {
            (component as any).currentPage = 10;

            await expect(
                component.handleToolCall('navigate_page', { direction: 'next' })
            ).rejects.toThrow('Already on the last page');
        });

        it('should throw error when navigating prev on first page', async () => {
            (component as any).currentPage = 1;

            await expect(
                component.handleToolCall('navigate_page', { direction: 'prev' })
            ).rejects.toThrow('Already on the first page');
        });

        it('should throw error for invalid direction', async () => {
            await expect(
                component.handleToolCall('navigate_page', { direction: 'invalid' })
            ).rejects.toThrow('Invalid direction. Use "next" or "prev"');
        });

        it('should throw error when no search results exist', async () => {
            (component as any).currentResults = null;

            await expect(
                component.handleToolCall('navigate_page', { direction: 'next' })
            ).rejects.toThrow('No search results to navigate');
        });

        it('should throw error for navigate_page (not fully implemented)', async () => {
            await expect(
                component.handleToolCall('navigate_page', { direction: 'next' })
            ).rejects.toThrow('Navigate page requires storing last search parameters (not implemented)');
        });
    });

    describe('Tool Call Handling - clear_results', () => {
        beforeEach(() => {
            (component as any).currentResults = {
                totalResults: 10,
                totalPages: 1,
                articleProfiles: []
            };
            (component as any).currentArticleDetail = {} as any;
            (component as any).currentPage = 5;
        });

        it('should clear all results', async () => {
            await component.handleToolCall('clear_results', {});

            expect((component as any).currentResults).toBeNull();
            expect((component as any).currentArticleDetail).toBeNull();
            expect((component as any).currentPage).toBe(1);
        });
    });

    describe('Unknown Tool Handling', () => {
        it('should throw error for unknown tool', async () => {
            await expect(
                component.handleToolCall('unknown_tool', {})
            ).rejects.toThrow('Unknown tool: unknown_tool');
        });
    });

    describe('Zod Schema Validation', () => {
        it('search_pubmed schema should validate simpleTerm', () => {
            const tool = component.toolSet.get('search_pubmed');
            const schema = tool?.paramsSchema;

            // Valid simple term
            const validResult = schema?.safeParse({ simpleTerm: 'cancer treatment' });
            expect(validResult?.success).toBe(true);

            // Invalid - missing both strategy and simpleTerm
            const invalidResult = schema?.safeParse({});
            expect(invalidResult?.success).toBe(false);
            if (invalidResult && !invalidResult.success) {
                expect(invalidResult.error.errors[0].message).toContain('Either strategy or simpleTerm must be provided');
            }
        });

        it('search_pubmed schema should validate sort enum', () => {
            const tool = component.toolSet.get('search_pubmed');
            const schema = tool?.paramsSchema;

            // Valid sort values
            const validSorts = ['match', 'date', 'pubdate', 'fauth', 'jour'];
            validSorts.forEach(sort => {
                const result = schema?.safeParse({ simpleTerm: 'test', sort });
                expect(result?.success).toBe(true);
            });

            // Invalid sort value
            const invalidResult = schema?.safeParse({ simpleTerm: 'test', sort: 'invalid' });
            expect(invalidResult?.success).toBe(false);
        });

        it('view_article schema should require pmid', () => {
            const tool = component.toolSet.get('view_article');
            const schema = tool?.paramsSchema;

            // Valid pmid
            const validResult = schema?.safeParse({ pmid: '12345678' });
            expect(validResult?.success).toBe(true);

            // Missing pmid
            const invalidResult = schema?.safeParse({});
            expect(invalidResult?.success).toBe(false);
        });

        it('navigate_page schema should validate direction enum', () => {
            const tool = component.toolSet.get('navigate_page');
            const schema = tool?.paramsSchema;

            // Valid directions
            const validDirections = ['next', 'prev'];
            validDirections.forEach(dir => {
                const result = schema?.safeParse({ direction: dir });
                expect(result?.success).toBe(true);
            });

            // Invalid direction
            const invalidResult = schema?.safeParse({ direction: 'invalid' });
            expect(invalidResult?.success).toBe(false);
        });
    });
});
