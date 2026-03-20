import { ToolComponent, ExportOptions } from '../core/toolComponent.js';
import { Tool } from '../core/types.js';
import { TUIElement, tdiv, th, tp } from '../ui/index.js';
import type { ToolCallResult } from '../core/types.js';
import {
  PubmedService,
  PubmedSearchParams,
  ArticleProfile,
  ArticleDetail,
  Author,
  Keyword,
  FullTextSource,
  renderRetrivalStrategy,
  RetrivalStrategy,
} from 'bibliography-search';
import { createBibliographySearchToolSet } from './bibliographySearchTools.js';

interface SavedArticle extends ArticleProfile {
  note?: string;
}

export class BibliographySearchComponent extends ToolComponent {
  toolSet: Map<string, Tool>;
  handleToolCall: (
    toolName: string,
    params: any,
  ) => Promise<ToolCallResult<any>>;

  private pubmedService: PubmedService;
  currentResults: {
    totalResults: number | null;
    totalPages: number | null;
    articleProfiles: ArticleProfile[];
  } | null = null;
  currentArticleDetail: ArticleDetail | null = null;
  currentPage = 1;
  currentRetrivalStrategy: RetrivalStrategy | null = null;
  currentSearchParams: PubmedSearchParams | null = null;
  savedArticles: Map<string, SavedArticle> = new Map();

  constructor() {
    super();
    this.pubmedService = new PubmedService();
    this.toolSet = this.initializeToolSet();
    this.handleToolCall = this.handleToolCallImpl.bind(this);
  }

  private initializeToolSet(): Map<string, Tool> {
    return createBibliographySearchToolSet();
  }

  renderImply = async (): Promise<TUIElement[]> => {
    const elements: TUIElement[] = [];

    // Render header
    elements.push(
      new th({
        content: 'Bibliography Search',
        styles: {
          align: 'center',
        },
      }),
    );

    // // Render current article detail if available
    if (this.currentArticleDetail) {
      elements.push(this.renderArticleDetail(this.currentArticleDetail));
    }

    // Render search results if available
    if (this.currentResults) {
      elements.push(this.renderSearchResults());
    } else if (!this.currentArticleDetail) {
      // Render welcome message only when no article detail is shown
      elements.push(
        new tdiv({
          content:
            'Welcome to Bibliography Search. Use tools to find articles.',
        }),
      );
    }

    // Render favorites section if there are saved articles
    if (this.savedArticles.size > 0) {
      elements.push(this.renderFavorites());
    }

    return elements;
  };

  renderSearchResults(): TUIElement {
    const container = new tdiv({
      styles: { showBorder: true },
    });

    container.addChild(
      new tdiv({
        content: 'Search Result',
        styles: {
          align: 'center',
        },
      }),
    );

    // Add retrieval strategy if available
    if (this.currentRetrivalStrategy) {
      const strategyDiv = new tdiv({
        styles: { showBorder: true, padding: { vertical: 1 } },
      });
      strategyDiv.addChild(
        new tp({
          content: 'Retrieval Strategy:',
          indent: 1,
          textStyle: { bold: true },
        }),
      );
      strategyDiv.addChild(
        new tp({
          content: renderRetrivalStrategy(this.currentRetrivalStrategy),
          indent: 1,
        }),
      );
      container.addChild(strategyDiv);
    }

    // Add search parameters if available
    if (this.currentSearchParams) {
      const paramsDiv = new tdiv({
        styles: { showBorder: true, padding: { vertical: 1 } },
      });
      paramsDiv.addChild(
        new tp({
          content: 'Search Parameters:',
          indent: 1,
          textStyle: { bold: true },
        }),
      );

      // Display search term
      paramsDiv.addChild(
        new tp({
          content: `  Term: ${this.currentSearchParams.term}`,
          indent: 1,
        }),
      );

      // Display sort order
      paramsDiv.addChild(
        new tp({
          content: `  Sort: ${this.currentSearchParams.sort} (${this.currentSearchParams.sortOrder === 'dsc' ? 'Descending' : 'Ascending'})`,
          indent: 1,
        }),
      );

      // Display filters if any
      if (
        this.currentSearchParams.filter &&
        this.currentSearchParams.filter.length > 0
      ) {
        paramsDiv.addChild(
          new tp({
            content: `  Filters: ${this.currentSearchParams.filter.join(', ')}`,
            indent: 1,
          }),
        );
      }

      // Display page info
      paramsDiv.addChild(
        new tp({
          content: `  Page: ${this.currentSearchParams.page}`,
          indent: 1,
        }),
      );

      container.addChild(paramsDiv);
    }

    // Add summary
    const summary =
      this.currentResults!.totalResults !== null
        ? `Found ${this.currentResults!.totalResults} articles (Page ${this.currentPage}${this.currentResults!.totalPages ? ` of ${this.currentResults!.totalPages}` : ''})`
        : 'Search results';
    container.addChild(
      new tdiv({ content: summary, styles: { showBorder: true } }),
    );

    // Add separator
    // container.addChild(new tp({ content: '─'.repeat(60) }));

    // Add article profiles
    if (this.currentResults!.articleProfiles.length === 0) {
      container.addChild(new tp({ content: 'No articles found.', indent: 1 }));
    } else {
      this.currentResults!.articleProfiles.forEach((article, index) => {
        const articleBox = new tdiv({
          styles: { showBorder: false, padding: { vertical: 1 } },
        });

        articleBox.addChild(
          new tp({
            content: `${index + 1}. ${article.title}`,
            indent: 1,
            // textStyle: { bold: true }
          }),
        );

        if (article.authors) {
          articleBox.addChild(
            new tp({ content: `   Authors: ${article.authors}`, indent: 1 }),
          );
        }

        if (article.journalCitation) {
          articleBox.addChild(
            new tp({
              content: `   Journal: ${article.journalCitation}`,
              indent: 1,
            }),
          );
        }

        articleBox.addChild(
          new tp({ content: `   PMID: ${article.pmid}`, indent: 1 }),
        );

        if (article.snippet) {
          articleBox.addChild(
            new tp({
              content: `   Abstract: ${article.snippet.substring(0, 200)}${article.snippet.length > 200 ? '...' : ''}`,
              indent: 1,
            }),
          );
        }

        container.addChild(articleBox);
      });
    }

    return container;
  }

  renderFavorites(): TUIElement {
    const container = new tdiv({
      styles: { showBorder: true },
    });

    container.addChild(
      new tdiv({
        content: 'My Favorites',
        styles: {
          align: 'center',
        },
      }),
    );

    container.addChild(
      new tp({
        content: `${this.savedArticles.size} article(s) saved`,
        indent: 1,
        textStyle: { bold: true },
      }),
    );

    // Add saved articles
    this.savedArticles.forEach((article, pmid) => {
      const articleBox = new tdiv({
        styles: { showBorder: false, padding: { vertical: 1 } },
      });

      articleBox.addChild(
        new tp({
          content: `PMID: ${pmid}`,
          indent: 1,
          textStyle: { bold: true },
        }),
      );

      articleBox.addChild(
        new tp({
          content: `  Title: ${article.title}`,
          indent: 1,
        }),
      );

      if (article.authors) {
        articleBox.addChild(
          new tp({
            content: `  Authors: ${article.authors}`,
            indent: 1,
          }),
        );
      }

      if (article.journalCitation) {
        articleBox.addChild(
          new tp({
            content: `  Journal: ${article.journalCitation}`,
            indent: 1,
          }),
        );
      }

      if (article.note) {
        articleBox.addChild(
          new tp({
            content: `  Note: ${article.note}`,
            indent: 1,
            textStyle: { italic: true },
          }),
        );
      }

      container.addChild(articleBox);
    });

    return container;
  }

  private renderArticleDetail(article: ArticleDetail): TUIElement {
    const container = new tdiv({
      content: 'Article Detail',
      styles: { showBorder: true },
    });

    // Title
    container.addChild(
      new th({
        content: article.title,
        level: 2,
        underline: true,
      }),
    );

    // Basic info
    container.addChild(new tp({ content: `PMID: ${article.pmid}`, indent: 1 }));
    container.addChild(new tp({ content: `DOI: ${article.doi}`, indent: 1 }));

    // Authors
    if (article.authors && article.authors.length > 0) {
      container.addChild(new th({ content: 'Authors:', level: 3 }));
      article.authors.forEach((author: Author) => {
        container.addChild(
          new tp({ content: `  - ${author.name}`, indent: 1 }),
        );
      });
    }

    // Journal info
    if (article.journalInfo) {
      container.addChild(new th({ content: 'Journal:', level: 3 }));
      if (article.journalInfo.title) {
        container.addChild(
          new tp({ content: `  ${article.journalInfo.title}`, indent: 1 }),
        );
      }
      if (
        article.journalInfo.volume ||
        article.journalInfo.issue ||
        article.journalInfo.pages
      ) {
        const citation = [
          article.journalInfo.volume,
          article.journalInfo.issue,
          article.journalInfo.pages,
        ]
          .filter(Boolean)
          .join(':');
        if (citation) {
          container.addChild(new tp({ content: `  ${citation}`, indent: 1 }));
        }
      }
      if (article.journalInfo.pubDate) {
        container.addChild(
          new tp({
            content: `  Published: ${article.journalInfo.pubDate}`,
            indent: 1,
          }),
        );
      }
    }

    // Abstract
    if (article.abstract) {
      container.addChild(new th({ content: 'Abstract:', level: 3 }));
      // Normalize excessive newlines in abstract to prevent rendering issues
      const normalizedAbstract = article.abstract.replace(/\n{3,}/g, '\n\n');
      container.addChild(new tp({ content: normalizedAbstract, indent: 1 }));
    }

    // Keywords
    if (article.keywords && article.keywords.length > 0) {
      container.addChild(new th({ content: 'Keywords:', level: 3 }));
      const keywordsText = article.keywords
        .map((k: Keyword) => (k.isMeSH ? `${k.text} (MeSH)` : k.text))
        .join(', ');
      container.addChild(new tp({ content: `  ${keywordsText}`, indent: 1 }));
    }

    // MeSH Terms
    if (article.meshTerms && article.meshTerms.length > 0) {
      container.addChild(new th({ content: 'MeSH Terms:', level: 3 }));
      article.meshTerms.forEach((term: Keyword) => {
        container.addChild(new tp({ content: `  - ${term.text}`, indent: 1 }));
      });
    }

    // Publication Types
    if (article.publicationTypes && article.publicationTypes.length > 0) {
      container.addChild(new th({ content: 'Publication Types:', level: 3 }));
      article.publicationTypes.forEach((type: string) => {
        container.addChild(new tp({ content: `  - ${type}`, indent: 1 }));
      });
    }

    // Conflict of Interest
    if (article.conflictOfInterestStatement) {
      container.addChild(
        new th({ content: 'Conflict of Interest:', level: 3 }),
      );
      container.addChild(
        new tp({ content: article.conflictOfInterestStatement, indent: 1 }),
      );
    }

    // Full Text Sources
    if (article.fullTextSources && article.fullTextSources.length > 0) {
      container.addChild(new th({ content: 'Full Text Sources:', level: 3 }));
      article.fullTextSources.forEach((source: FullTextSource) => {
        container.addChild(
          new tp({ content: `  - ${source.name}: ${source.url}`, indent: 1 }),
        );
      });
    }

    return container;
  }

  private async handleToolCallImpl(
    toolName: string,
    params: any,
  ): Promise<ToolCallResult<any>> {
    switch (toolName) {
      case 'search_pubmed':
        return await this.handleSearch(params);
      case 'view_article':
        return await this.handleViewArticle(params);
      case 'navigate_page':
        return await this.handleNavigatePage(params);
      case 'clear_results':
        return this.handleClearResults();
      case 'save_article':
        return this.handleSaveArticle(params);
      case 'remove_from_favorites':
        return this.handleRemoveFromFavorites(params);
      case 'get_favorites':
        return this.handleGetFavorites(params);
      case 'update_article_note':
        return this.handleUpdateArticleNote(params);
      default:
        return {
          success: false,
          data: { error: `Unknown tool: ${toolName}` },
          summary: `[Bibliography] 未知工具: ${toolName}`,
        };
    }
  }

  private async handleSearch(params: any): Promise<ToolCallResult<any>> {
    let searchTerm: string;

    // Build search term from strategy or use simple term
    if (params.term) {
      searchTerm = params.term;
      this.currentRetrivalStrategy = null;
    } else {
      return {
        success: false,
        data: { error: 'term must be provided' },
        summary: '[Bibliography] 错误: 未提供搜索词',
      };
    }

    const searchParams: PubmedSearchParams = {
      term: searchTerm,
      sort: params.sort || 'match',
      sortOrder: params.sortOrder || 'dsc',
      filter: params.filter || [],
      page: params.page || 1,
    };

    // Store search parameters for display
    this.currentSearchParams = searchParams;

    try {
      const results = await this.pubmedService.searchByPattern(searchParams);
      console.log(results.totalPages);
      this.currentResults = {
        totalResults: results.totalResults,
        totalPages: results.totalPages,
        articleProfiles: results.articleProfiles,
      };
      this.currentPage = searchParams.page || 1;
      this.currentArticleDetail = null;
      return {
        success: true,
        data: {
          term: searchTerm,
          totalResults: results.totalResults,
          totalPages: results.totalPages,
        },
        summary: `[Bibliography] 搜索: ${searchTerm}, 找到 ${results.totalResults} 篇文献`,
      };
    } catch (error) {
      return {
        success: false,
        data: {
          error: `Search failed: ${error instanceof Error ? error.message : String(error)}`,
        },
        summary: `[Bibliography] 搜索失败`,
      };
    }
  }

  private async handleViewArticle(params: any): Promise<ToolCallResult<any>> {
    const { pmid } = params;

    if (!pmid) {
      return {
        success: false,
        data: { error: 'PMID is required' },
        summary: '[Bibliography] 错误: 未提供 PMID',
      };
    }

    try {
      const detail = await this.pubmedService.getArticleDetail(pmid);
      this.currentArticleDetail = detail;
      return {
        success: true,
        data: { pmid, title: detail.title },
        summary: `[Bibliography] 查看文献: ${detail.title?.substring(0, 50) || pmid}`,
      };
    } catch (error) {
      return {
        success: false,
        data: {
          error: `Failed to load article details: ${error instanceof Error ? error.message : String(error)}`,
        },
        summary: `[Bibliography] 加载文献失败`,
      };
    }
  }

  private async handleNavigatePage(params: any): Promise<ToolCallResult<any>> {
    if (!this.currentResults) {
      return {
        success: false,
        data: { error: 'No search results to navigate' },
        summary: '[Bibliography] 错误: 无搜索结果',
      };
    }

    if (!this.currentSearchParams) {
      return {
        success: false,
        data: { error: 'No search parameters available for navigation' },
        summary: '[Bibliography] 错误: 无搜索参数',
      };
    }

    const { direction } = params;
    const totalPages = this.currentResults.totalPages || 1;

    if (direction === 'next') {
      if (this.currentPage >= totalPages) {
        return {
          success: false,
          data: { error: 'Already on the last page' },
          summary: '[Bibliography] 已是最后一页',
        };
      }
      this.currentPage++;
    } else if (direction === 'prev') {
      if (this.currentPage <= 1) {
        return {
          success: false,
          data: { error: 'Already on the first page' },
          summary: '[Bibliography] 已是第一页',
        };
      }
      this.currentPage--;
    } else {
      return {
        success: false,
        data: { error: 'Invalid direction. Use "next" or "prev"' },
        summary: '[Bibliography] 错误: 无效方向',
      };
    }

    // Re-run search with new page using stored search parameters
    const searchParams: PubmedSearchParams = {
      ...this.currentSearchParams,
      page: this.currentPage,
    };

    try {
      const results = await this.pubmedService.searchByPattern(searchParams);
      this.currentResults = {
        totalResults: results.totalResults,
        totalPages: results.totalPages,
        articleProfiles: results.articleProfiles,
      };
      this.currentArticleDetail = null;
      return {
        success: true,
        data: { page: this.currentPage, totalPages },
        summary: `[Bibliography] flip: 第 ${this.currentPage} / ${totalPages} 页`,
      };
    } catch (error) {
      return {
        success: false,
        data: {
          error: `Navigation failed: ${error instanceof Error ? error.message : String(error)}`,
        },
        summary: `[Bibliography] flip failed`,
      };
    }
  }

  private handleClearResults(): ToolCallResult<any> {
    this.currentResults = null;
    this.currentArticleDetail = null;
    this.currentPage = 1;
    this.currentRetrivalStrategy = null;
    this.currentSearchParams = null;
    return {
      success: true,
      data: { cleared: true },
      summary: '[Bibliography] 已清除结果',
    };
  }

  private handleSaveArticle(params: any): ToolCallResult<any> {
    const { pmid, note } = params;

    if (!pmid) {
      return {
        success: false,
        data: { error: 'PMID is required' },
        summary: '[Bibliography] 错误: 未提供 PMID',
      };
    }

    // Try to find the article in current results or current article detail
    let articleToSave: SavedArticle | null = null;

    // Check if already saved (to preserve existing note)
    const existingArticle = this.savedArticles.get(pmid);

    // Check current results
    if (this.currentResults) {
      articleToSave =
        this.currentResults.articleProfiles.find((a) => a.pmid === pmid) ??
        null;
    }

    // Check if viewing the article detail
    if (
      !articleToSave &&
      this.currentArticleDetail &&
      this.currentArticleDetail.pmid === pmid
    ) {
      articleToSave = {
        doi: null,
        pmid: this.currentArticleDetail.pmid,
        title: this.currentArticleDetail.title,
        authors:
          this.currentArticleDetail.authors?.map((a) => a.name).join(', ') ||
          '',
        journalCitation: this.currentArticleDetail.journalInfo?.title || '',
        snippet: this.currentArticleDetail.abstract,
      };
    }

    if (!articleToSave) {
      return {
        success: false,
        data: {
          error: 'Article not found. Please search or view the article first.',
        },
        summary: '[Bibliography] 错误: 文献未找到，请先搜索或查看该文献',
      };
    }

    // Preserve existing note if not providing a new one
    if (existingArticle && !note) {
      articleToSave.note = existingArticle.note;
    } else {
      articleToSave.note = note;
    }

    this.savedArticles.set(pmid, articleToSave);
    return {
      success: true,
      data: {
        pmid,
        title: articleToSave.title,
        note: articleToSave.note,
        totalFavorites: this.savedArticles.size,
      },
      summary: `[Bibliography] 已收藏: ${articleToSave.title?.substring(0, 30) || pmid}...`,
    };
  }

  private handleRemoveFromFavorites(params: any): ToolCallResult<any> {
    const { pmid } = params;

    if (!pmid) {
      return {
        success: false,
        data: { error: 'PMID is required' },
        summary: '[Bibliography] 错误: 未提供 PMID',
      };
    }

    if (!this.savedArticles.has(pmid)) {
      return {
        success: false,
        data: { error: 'Article not in favorites' },
        summary: '[Bibliography] 错误: 该文献不在收藏夹中',
      };
    }

    const removed = this.savedArticles.get(pmid);
    this.savedArticles.delete(pmid);
    return {
      success: true,
      data: {
        pmid,
        removedTitle: removed?.title,
        remainingFavorites: this.savedArticles.size,
      },
      summary: `[Bibliography] 已取消收藏: ${removed?.title?.substring(0, 30) || pmid}...`,
    };
  }

  private handleGetFavorites(_params: any): ToolCallResult<any> {
    const favorites = Array.from(this.savedArticles.entries()).map(
      ([pmid, article]) => ({
        pmid,
        title: article.title,
        authors: article.authors,
        journalCitation: article.journalCitation,
        note: article.note,
      }),
    );

    return {
      success: true,
      data: {
        favorites,
        total: this.savedArticles.size,
      },
      summary: `[Bibliography] 收藏夹: ${this.savedArticles.size} 篇文献`,
    };
  }

  private handleUpdateArticleNote(params: any): ToolCallResult<any> {
    const { pmid, note } = params;

    if (!pmid) {
      return {
        success: false,
        data: { error: 'PMID is required' },
        summary: '[Bibliography] 错误: 未提供 PMID',
      };
    }

    const article = this.savedArticles.get(pmid);
    if (!article) {
      return {
        success: false,
        data: { error: 'Article not in favorites' },
        summary: '[Bibliography] 错误: 该文献不在收藏夹中',
      };
    }

    article.note = note || undefined;
    this.savedArticles.set(pmid, article);

    return {
      success: true,
      data: { pmid, note: article.note },
      summary: `[Bibliography] 已更新备注: ${article.title?.substring(0, 30) || pmid}`,
    };
  }

  async exportData(options?: ExportOptions) {
    return {
      data: {
        currentResults: this.currentResults,
        currentArticleDetail: this.currentArticleDetail,
        currentPage: this.currentPage,
        currentRetrivalStrategy: this.currentRetrivalStrategy,
        currentSearchParams: this.currentSearchParams,
        savedArticles: Array.from(this.savedArticles.entries()),
      },
      format: options?.format ?? 'json',
      metadata: {
        componentId: this.componentId,
        exportedAt: new Date().toISOString(),
      },
    };
  }
}
