import { Tool, ToolComponent, TUIElement, tdiv, th, tp } from 'stateful-context'
import {
    PubmedService,
    PubmedSearchParams,
    ArticleProfile,
    ArticleDetail,
    Author,
    Keyword,
    FullTextSource,
    renderRetrivalStrategy,
    RetrivalStrategy
} from 'med_database_portal'
import { createBibliographySearchToolSet } from './bibliographySearchTools.js'

export class BibliographySearchComponent extends ToolComponent {
    override toolSet: Map<string, Tool>;
    override handleToolCall: (toolName: string, params: any) => Promise<void>;

    private pubmedService: PubmedService;
    currentResults: { totalResults: number | null; totalPages: number | null; articleProfiles: ArticleProfile[] } | null = null;
    currentArticleDetail: ArticleDetail | null = null;
    currentPage: number = 1;
    currentRetrivalStrategy: RetrivalStrategy | null = null;
    currentSearchParams: PubmedSearchParams | null = null;

    constructor() {
        super();
        this.pubmedService = new PubmedService();
        this.toolSet = this.initializeToolSet();
        this.handleToolCall = this.handleToolCallImpl.bind(this);
    }

    private initializeToolSet(): Map<string, Tool> {
        return createBibliographySearchToolSet();
    }

    renderImply = async () => {
        const elements: TUIElement[] = [];

        // Render header
        elements.push(new th({
            content: 'Bibliography Search', styles: {
                align: 'center'
            }
        }));

        const strategyElement = new tdiv({
            content: 'Retrieval Strategy',
            styles: {
                showBorder: true,
                align: 'center'
            }
        })

        // // Render current article detail if available
        if (this.currentArticleDetail) {
            elements.push(this.renderArticleDetail(this.currentArticleDetail));
            // return elements;
        }

        // Render search results if available
        if (this.currentResults) {
            elements.push(this.renderSearchResults());
        } else {
            // Render welcome message
            elements.push(new tdiv({
                content: 'Welcome to Bibliography Search. Use the search_pubmed tool to find articles.',

            }));
        }

        return elements;
    }

    renderSearchResults(): TUIElement {
        const container = new tdiv({
            styles: { showBorder: true }
        });

        container.addChild(new tdiv({
            content: 'Search Result',
            styles: {
                align: 'center'
            }
        }))

        // Add retrieval strategy if available
        if (this.currentRetrivalStrategy) {
            const strategyDiv = new tdiv({
                styles: { showBorder: true, padding: { vertical: 1 } }
            });
            strategyDiv.addChild(new tp({
                content: 'Retrieval Strategy:',
                indent: 1,
                textStyle: { bold: true }
            }));
            strategyDiv.addChild(new tp({
                content: renderRetrivalStrategy(this.currentRetrivalStrategy),
                indent: 1
            }));
            container.addChild(strategyDiv);
        }

        // Add search parameters if available
        if (this.currentSearchParams) {
            const paramsDiv = new tdiv({
                styles: { showBorder: true, padding: { vertical: 1 } }
            });
            paramsDiv.addChild(new tp({
                content: 'Search Parameters:',
                indent: 1,
                textStyle: { bold: true }
            }));

            // Display search term
            paramsDiv.addChild(new tp({
                content: `  Term: ${this.currentSearchParams.term}`,
                indent: 1
            }));

            // Display sort order
            paramsDiv.addChild(new tp({
                content: `  Sort: ${this.currentSearchParams.sort} (${this.currentSearchParams.sortOrder === 'dsc' ? 'Descending' : 'Ascending'})`,
                indent: 1
            }));

            // Display filters if any
            if (this.currentSearchParams.filter && this.currentSearchParams.filter.length > 0) {
                paramsDiv.addChild(new tp({
                    content: `  Filters: ${this.currentSearchParams.filter.join(', ')}`,
                    indent: 1
                }));
            }

            // Display page info
            paramsDiv.addChild(new tp({
                content: `  Page: ${this.currentSearchParams.page}`,
                indent: 1
            }));

            container.addChild(paramsDiv);
        }

        // Add summary
        const summary = this.currentResults!.totalResults !== null
            ? `Found ${this.currentResults!.totalResults} articles (Page ${this.currentPage}${this.currentResults!.totalPages ? ` of ${this.currentResults!.totalPages}` : ''})`
            : 'Search results';
        container.addChild(new tdiv({ content: summary, styles: { showBorder: true } }));

        // Add separator
        // container.addChild(new tp({ content: '─'.repeat(60) }));

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
                    // textStyle: { bold: true }
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
            content: 'Article Detail',
            styles: { showBorder: true }
        });

        // Title
        container.addChild(new th({
            content: article.title,
            level: 2,
            underline: true,
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
        if (params.term) {
            searchTerm = params.term;
            this.currentRetrivalStrategy = null;
        } else {
            throw new Error('term must be provided');
        }

        const searchParams: PubmedSearchParams = {
            term: searchTerm,
            sort: params.sort || 'match',
            sortOrder: params.sortOrder || 'dsc',
            filter: params.filter || [],
            page: params.page || 1
        };

        // Store search parameters for display
        this.currentSearchParams = searchParams;

        try {
            const results = await this.pubmedService.searchByPattern(searchParams);
            console.log(results.totalPages)
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
        this.currentRetrivalStrategy = null;
        this.currentSearchParams = null;
    }
}
