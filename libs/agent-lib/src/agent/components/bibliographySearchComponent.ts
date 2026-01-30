import { Tool, ToolComponent, TUIElement, tdiv, th, tp } from 'statefulContext'
import {
    PubmedService,
    PubmedSearchParams,
    ArticleProfile,
    ArticleDetail,
    Author,
    Keyword,
    FullTextSource,
    FieldConstraint,
    RetrivalStrategy,
    renderRetrivalStrategy
} from 'nih-client'
import * as z from 'zod'

// Recursive schema for retrieval strategy
const retrievalStrategySchema: z.ZodType<RetrivalStrategy> = z.lazy(() =>
    z.object({
        term: z.string(),
        filed: z.array(z.custom<FieldConstraint>()) as z.ZodType<FieldConstraint[]>,
        AND: z.array(z.lazy(() => retrievalStrategySchema)).nullable(),
        OR: z.array(z.lazy(() => retrievalStrategySchema)).nullable(),
        NOT: z.array(z.lazy(() => retrievalStrategySchema)).nullable()
    })
);

export class BibliographySearchComponent extends ToolComponent {
    override toolSet: Map<string, Tool>;
    override renderImply: () => Promise<TUIElement[]>;
    override handleToolCall: (toolName: string, params: any) => Promise<void>;

    private pubmedService: PubmedService;
    private currentResults: { totalResults: number | null; totalPages: number | null; articleProfiles: ArticleProfile[] } | null = null;
    private currentArticleDetail: ArticleDetail | null = null;
    private currentPage: number = 1;

    constructor() {
        super();
        this.pubmedService = new PubmedService();
        this.toolSet = this.initializeToolSet();
        this.renderImply = this.renderImplyImpl.bind(this);
        this.handleToolCall = this.handleToolCallImpl.bind(this);
    }

    private initializeToolSet(): Map<string, Tool> {
        const tools = new Map<string, Tool>();

        // Tool for searching PubMed
        tools.set('search_pubmed', {
            toolName: 'search_pubmed',
            desc: 'Search PubMed articles using retrieval strategy or simple term',
            paramsSchema: z.object({
                strategy: retrievalStrategySchema.optional().describe('Retrieval strategy with term, field constraints, and logical operators (AND/OR/NOT)'),
                simpleTerm: z.string().optional().describe('Simple search term (alternative to strategy)'),
                sort: z.enum(['match', 'date', 'pubdate', 'fauth', 'jour']).optional().describe('Sort order: match (relevance), date, pubdate, fauth (first author), jour (journal)'),
                sortOrder: z.enum(['asc', 'dsc']).optional().describe('Sort direction: asc (ascending), dsc (descending)'),
                filter: z.array(z.string()).optional().describe('Filters to apply (e.g., publication dates, article types)'),
                page: z.number().optional().describe('Page number to retrieve')
            }).refine(data => data.strategy || data.simpleTerm, {
                message: 'Either strategy or simpleTerm must be provided'
            })
        });

        // Tool for viewing article details
        tools.set('view_article', {
            toolName: 'view_article',
            desc: 'View detailed information about a specific article by PMID',
            paramsSchema: z.object({
                pmid: z.string().describe('PubMed ID (PMID) of article')
            })
        });

        // Tool for navigating pages
        tools.set('navigate_page', {
            toolName: 'navigate_page',
            desc: 'Navigate to next or previous page of search results',
            paramsSchema: z.object({
                direction: z.enum(['next', 'prev']).describe('Direction: next for next page, prev for previous page')
            })
        });

        // Tool for clearing results
        tools.set('clear_results', {
            toolName: 'clear_results',
            desc: 'Clear current search results and article details',
            paramsSchema: z.object({})
        });

        return tools;
    }

    private async renderImplyImpl(): Promise<TUIElement[]> {
        const elements: TUIElement[] = [];

        // Render header
        elements.push(new th({ content: 'Bibliography Search', level: 1, underline: true }));

        // Render current article detail if available
        if (this.currentArticleDetail) {
            elements.push(this.renderArticleDetail(this.currentArticleDetail));
            return elements;
        }

        // Render search results if available
        if (this.currentResults) {
            elements.push(this.renderSearchResults());
        } else {
            // Render welcome message
            elements.push(new tp({
                content: 'Welcome to Bibliography Search. Use the search_pubmed tool to find articles.',
                indent: 2
            }));
        }

        return elements;
    }

    private renderSearchResults(): TUIElement {
        const container = new tdiv({
            styles: { showBorder: true, padding: { all: 1 } }
        });

        // Add summary
        const summary = this.currentResults!.totalResults !== null
            ? `Found ${this.currentResults!.totalResults} articles (Page ${this.currentPage}${this.currentResults!.totalPages ? ` of ${this.currentResults!.totalPages}` : ''})`
            : 'Search results';
        container.addChild(new tp({ content: summary, indent: 1 }));

        // Add separator
        container.addChild(new tp({ content: '─'.repeat(60) }));

        // Add article profiles
        if (this.currentResults!.articleProfiles.length === 0) {
            container.addChild(new tp({ content: 'No articles found.', indent: 1 }));
        } else {
            this.currentResults!.articleProfiles.forEach((article, index) => {
                const articleBox = new tdiv({
                    styles: { showBorder: false, padding: { vertical: 1 } }
                });

                articleBox.addChild(new tp({
                    content: `${index + 1}. ${article.title}`,
                    indent: 1,
                    textStyle: { bold: true }
                }));

                if (article.authors) {
                    articleBox.addChild(new tp({ content: `   Authors: ${article.authors}`, indent: 1 }));
                }

                if (article.journalCitation) {
                    articleBox.addChild(new tp({ content: `   Journal: ${article.journalCitation}`, indent: 1 }));
                }

                articleBox.addChild(new tp({ content: `   PMID: ${article.pmid}`, indent: 1 }));

                if (article.snippet) {
                    articleBox.addChild(new tp({
                        content: `   Abstract: ${article.snippet.substring(0, 200)}${article.snippet.length > 200 ? '...' : ''}`,
                        indent: 1
                    }));
                }

                container.addChild(articleBox);
            });
        }

        return container;
    }

    private renderArticleDetail(article: ArticleDetail): TUIElement {
        const container = new tdiv({
            styles: { showBorder: true, padding: { all: 1 } }
        });

        // Title
        container.addChild(new th({
            content: article.title,
            level: 2,
            underline: true,
            textStyle: { bold: true }
        }));

        container.addChild(new tp({ content: '' }));

        // Basic info
        container.addChild(new tp({ content: `PMID: ${article.pmid}`, indent: 1 }));
        container.addChild(new tp({ content: `DOI: ${article.doi}`, indent: 1 }));

        // Authors
        if (article.authors && article.authors.length > 0) {
            container.addChild(new tp({ content: '', indent: 1 }));
            container.addChild(new th({ content: 'Authors:', level: 3 }));
            article.authors.forEach((author: Author) => {
                container.addChild(new tp({ content: `  - ${author.name}`, indent: 1 }));
            });
        }

        // Journal info
        if (article.journalInfo) {
            container.addChild(new tp({ content: '', indent: 1 }));
            container.addChild(new th({ content: 'Journal:', level: 3 }));
            if (article.journalInfo.title) {
                container.addChild(new tp({ content: `  ${article.journalInfo.title}`, indent: 1 }));
            }
            if (article.journalInfo.volume || article.journalInfo.issue || article.journalInfo.pages) {
                const citation = [article.journalInfo.volume, article.journalInfo.issue, article.journalInfo.pages]
                    .filter(Boolean)
                    .join(':');
                if (citation) {
                    container.addChild(new tp({ content: `  ${citation}`, indent: 1 }));
                }
            }
            if (article.journalInfo.pubDate) {
                container.addChild(new tp({ content: `  Published: ${article.journalInfo.pubDate}`, indent: 1 }));
            }
        }

        // Abstract
        if (article.abstract) {
            container.addChild(new tp({ content: '', indent: 1 }));
            container.addChild(new th({ content: 'Abstract:', level: 3 }));
            container.addChild(new tp({ content: article.abstract, indent: 1 }));
        }

        // Keywords
        if (article.keywords && article.keywords.length > 0) {
            container.addChild(new tp({ content: '', indent: 1 }));
            container.addChild(new th({ content: 'Keywords:', level: 3 }));
            const keywordsText = article.keywords
                .map((k: Keyword) => k.isMeSH ? `${k.text} (MeSH)` : k.text)
                .join(', ');
            container.addChild(new tp({ content: `  ${keywordsText}`, indent: 1 }));
        }

        // MeSH Terms
        if (article.meshTerms && article.meshTerms.length > 0) {
            container.addChild(new tp({ content: '', indent: 1 }));
            container.addChild(new th({ content: 'MeSH Terms:', level: 3 }));
            article.meshTerms.forEach((term: Keyword) => {
                container.addChild(new tp({ content: `  - ${term.text}`, indent: 1 }));
            });
        }

        // Publication Types
        if (article.publicationTypes && article.publicationTypes.length > 0) {
            container.addChild(new tp({ content: '', indent: 1 }));
            container.addChild(new th({ content: 'Publication Types:', level: 3 }));
            article.publicationTypes.forEach((type: string) => {
                container.addChild(new tp({ content: `  - ${type}`, indent: 1 }));
            });
        }

        // Conflict of Interest
        if (article.conflictOfInterestStatement) {
            container.addChild(new tp({ content: '', indent: 1 }));
            container.addChild(new th({ content: 'Conflict of Interest:', level: 3 }));
            container.addChild(new tp({ content: article.conflictOfInterestStatement, indent: 1 }));
        }

        // Full Text Sources
        if (article.fullTextSources && article.fullTextSources.length > 0) {
            container.addChild(new tp({ content: '', indent: 1 }));
            container.addChild(new th({ content: 'Full Text Sources:', level: 3 }));
            article.fullTextSources.forEach((source: FullTextSource) => {
                container.addChild(new tp({ content: `  - ${source.name}: ${source.url}`, indent: 1 }));
            });
        }

        return container;
    }

    private async handleToolCallImpl(toolName: string, params: any): Promise<void> {
        switch (toolName) {
            case 'search_pubmed':
                await this.handleSearch(params);
                break;
            case 'view_article':
                await this.handleViewArticle(params);
                break;
            case 'navigate_page':
                await this.handleNavigatePage(params);
                break;
            case 'clear_results':
                this.handleClearResults();
                break;
            default:
                throw new Error(`Unknown tool: ${toolName}`);
        }
    }

    private async handleSearch(params: any): Promise<void> {
        let searchTerm: string;

        // Build search term from strategy or use simple term
        if (params.strategy) {
            searchTerm = renderRetrivalStrategy(params.strategy);
        } else if (params.simpleTerm) {
            searchTerm = params.simpleTerm;
        } else {
            throw new Error('Either strategy or simpleTerm must be provided');
        }

        const searchParams: PubmedSearchParams = {
            term: searchTerm,
            sort: params.sort || 'match',
            sortOrder: params.sortOrder || 'dsc',
            filter: params.filter || [],
            page: params.page || 1
        };

        try {
            const results = await this.pubmedService.searchByPattern(searchParams);
            this.currentResults = {
                totalResults: results.totalResults,
                totalPages: results.totalPages,
                articleProfiles: results.articleProfiles
            };
            this.currentPage = searchParams.page || 1;
            this.currentArticleDetail = null;
        } catch (error) {
            throw new Error(`Search failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async handleViewArticle(params: any): Promise<void> {
        const { pmid } = params;

        if (!pmid) {
            throw new Error('PMID is required');
        }

        try {
            const detail = await this.pubmedService.getArticleDetail(pmid);
            this.currentArticleDetail = detail;
        } catch (error) {
            throw new Error(`Failed to load article details: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async handleNavigatePage(params: any): Promise<void> {
        if (!this.currentResults) {
            throw new Error('No search results to navigate');
        }

        const { direction } = params;
        const totalPages = this.currentResults.totalPages || 1;

        if (direction === 'next') {
            if (this.currentPage >= totalPages) {
                throw new Error('Already on the last page');
            }
            this.currentPage++;
        } else if (direction === 'prev') {
            if (this.currentPage <= 1) {
                throw new Error('Already on the first page');
            }
            this.currentPage--;
        } else {
            throw new Error('Invalid direction. Use "next" or "prev"');
        }

        // Re-run search with new page
        // Note: We need to store the last search parameters for this to work properly
        // For now, this is a simplified implementation
        throw new Error('Navigate page requires storing last search parameters (not implemented)');
    }

    private handleClearResults(): void {
        this.currentResults = null;
        this.currentArticleDetail = null;
        this.currentPage = 1;
    }
}
