import {
  ReactiveToolComponent,
  type ExportOptions,
} from 'agent-lib/components';
import { TUIElement, tdiv, th, tp } from 'agent-lib/components/ui';
import type { ToolCallResult } from 'agent-lib/components';
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

interface BibliographySearchState {
  currentResults: {
    totalResults: number | null;
    totalPages: number | null;
    articleProfiles: ArticleProfile[];
  } | null;
  currentArticleDetail: ArticleDetail | null;
  currentPage: number;
  currentRetrivalStrategy: RetrivalStrategy | null;
  currentSearchParams: PubmedSearchParams | null;
  savedArticles: Map<string, SavedArticle>;
}

export class BibliographySearchComponent extends ReactiveToolComponent<BibliographySearchState> {
  override componentId = 'bibliography-search';
  override displayName = 'Bibliography Search';
  override description = 'Search and manage PubMed literature';
  override componentPrompt = `## Bibliography Search

This component provides access to PubMed literature database for evidence-based medicine research.

**Search Strategies:**
1. Start with broad searches using key concepts
2. Use PICO framework to refine search terms
3. Apply appropriate filters (date, article type, species)
4. Review abstracts to identify relevant studies
5. Save promising articles for detailed review

**Best Practices:**
- Combine Medical Subject Headings (MeSH) with free text
- Use field tags [tiab] for title/abstract search
- Check related articles for additional references
- Export citations in structured format for review`;

  private pubmedService: PubmedService;

  constructor() {
    super();
    this.pubmedService = new PubmedService();
  }

  protected override initialState(): BibliographySearchState {
    return {
      currentResults: null,
      currentArticleDetail: null,
      currentPage: 1,
      currentRetrivalStrategy: null,
      currentSearchParams: null,
      savedArticles: new Map(),
    };
  }

  protected override toolDefs() {
    const tools = createBibliographySearchToolSet();
    const defs: Record<
      string,
      { desc: string; paramsSchema: any; examples?: any[] }
    > = {};
    for (const [name, tool] of tools) {
      defs[name] = {
        desc: tool.desc,
        paramsSchema: tool.paramsSchema,
        examples: tool.examples,
      };
    }
    return defs;
  }

  renderImply = async (): Promise<TUIElement[]> => {
    const elements: TUIElement[] = [];
    const s = this.snapshot;

    elements.push(
      new th({
        content: 'Bibliography Search',
        styles: {
          align: 'center',
        },
      }),
    );

    if (s.currentArticleDetail) {
      elements.push(this.renderArticleDetail(s.currentArticleDetail));
    }

    if (s.currentResults) {
      elements.push(this.renderSearchResults());
    } else if (!s.currentArticleDetail) {
      elements.push(
        new tdiv({
          content:
            'Welcome to Bibliography Search. Use tools to find articles.',
        }),
      );
    }

    if (s.savedArticles.size > 0) {
      elements.push(this.renderFavorites());
    }

    return elements;
  };

  renderSearchResults(): TUIElement {
    const s = this.snapshot;
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

    if (s.currentRetrivalStrategy) {
      const strategyDiv = new tdiv({
        styles: { showBorder: true, padding: { vertical: 1 } },
      });
      strategyDiv.addChild(
        new tp({
          content: 'Retrieval Strategy:',
          indent: 1,
        }),
      );
      strategyDiv.addChild(
        new tp({
          content: renderRetrivalStrategy(s.currentRetrivalStrategy),
          indent: 1,
        }),
      );
      container.addChild(strategyDiv);
    }

    if (s.currentSearchParams) {
      const paramsDiv = new tdiv({
        styles: { showBorder: true, padding: { vertical: 1 } },
      });
      paramsDiv.addChild(
        new tp({
          content: 'Search Parameters:',
          indent: 1,
        }),
      );

      paramsDiv.addChild(
        new tp({
          content: `  Term: ${s.currentSearchParams.term}`,
          indent: 1,
        }),
      );

      paramsDiv.addChild(
        new tp({
          content: `  Sort: ${s.currentSearchParams.sort} (${s.currentSearchParams.sortOrder === 'dsc' ? 'Descending' : 'Ascending'})`,
          indent: 1,
        }),
      );

      if (
        s.currentSearchParams.filter &&
        s.currentSearchParams.filter.length > 0
      ) {
        paramsDiv.addChild(
          new tp({
            content: `  Filters: ${s.currentSearchParams.filter.join(', ')}`,
            indent: 1,
          }),
        );
      }

      paramsDiv.addChild(
        new tp({
          content: `  Page: ${s.currentSearchParams.page}`,
          indent: 1,
        }),
      );

      container.addChild(paramsDiv);
    }

    const summary =
      s.currentResults!.totalResults !== null
        ? `Found ${s.currentResults!.totalResults} articles (Page ${s.currentPage}${s.currentResults!.totalPages ? ` of ${s.currentResults!.totalPages}` : ''})`
        : 'Search results';
    container.addChild(
      new tdiv({ content: summary, styles: { showBorder: true } }),
    );

    if (s.currentResults!.articleProfiles.length === 0) {
      container.addChild(new tp({ content: 'No articles found.', indent: 1 }));
    } else {
      s.currentResults!.articleProfiles.forEach((article, index) => {
        const articleBox = new tdiv({
          styles: { showBorder: false, padding: { vertical: 1 } },
        });

        articleBox.addChild(
          new tp({
            content: `${index + 1}. ${article.title}`,
            indent: 1,
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
    const s = this.snapshot;
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
        content: `${s.savedArticles.size} article(s) saved`,
        indent: 1,
      }),
    );

    s.savedArticles.forEach((article, pmid) => {
      const articleBox = new tdiv({
        styles: { showBorder: false, padding: { vertical: 1 } },
      });

      articleBox.addChild(
        new tp({
          content: `PMID: ${pmid}`,
          indent: 1,
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

    container.addChild(
      new th({
        content: article.title,
        level: 2,
        underline: true,
      }),
    );

    container.addChild(new tp({ content: `PMID: ${article.pmid}`, indent: 1 }));
    container.addChild(new tp({ content: `DOI: ${article.doi}`, indent: 1 }));

    if (article.authors && article.authors.length > 0) {
      container.addChild(new th({ content: 'Authors:', level: 3 }));
      article.authors.forEach((author: Author) => {
        container.addChild(
          new tp({ content: `  - ${author.name}`, indent: 1 }),
        );
      });
    }

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

    if (article.abstract) {
      container.addChild(new th({ content: 'Abstract:', level: 3 }));
      const normalizedAbstract = article.abstract.replace(/\n{3,}/g, '\n\n');
      container.addChild(new tp({ content: normalizedAbstract, indent: 1 }));
    }

    if (article.keywords && article.keywords.length > 0) {
      container.addChild(new th({ content: 'Keywords:', level: 3 }));
      const keywordsText = article.keywords
        .map((k: Keyword) => (k.isMeSH ? `${k.text} (MeSH)` : k.text))
        .join(', ');
      container.addChild(new tp({ content: `  ${keywordsText}`, indent: 1 }));
    }

    if (article.meshTerms && article.meshTerms.length > 0) {
      container.addChild(new th({ content: 'MeSH Terms:', level: 3 }));
      article.meshTerms.forEach((term: Keyword) => {
        container.addChild(new tp({ content: `  - ${term.text}`, indent: 1 }));
      });
    }

    if (article.publicationTypes && article.publicationTypes.length > 0) {
      container.addChild(new th({ content: 'Publication Types:', level: 3 }));
      article.publicationTypes.forEach((type: string) => {
        container.addChild(new tp({ content: `  - ${type}`, indent: 1 }));
      });
    }

    if (article.conflictOfInterestStatement) {
      container.addChild(
        new th({ content: 'Conflict of Interest:', level: 3 }),
      );
      container.addChild(
        new tp({ content: article.conflictOfInterestStatement, indent: 1 }),
      );
    }

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

  async onSearch_pubmed(params: any): Promise<ToolCallResult<any>> {
    let searchTerm: string;

    if (params.term) {
      searchTerm = params.term;
      this.reactive.currentRetrivalStrategy = null;
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

    this.reactive.currentSearchParams = searchParams;

    try {
      const results = await this.pubmedService.searchByPattern(searchParams);
      console.log(results.totalPages);
      this.reactive.currentResults = {
        totalResults: results.totalResults,
        totalPages: results.totalPages,
        articleProfiles: results.articleProfiles,
      };
      this.reactive.currentPage = searchParams.page || 1;
      this.reactive.currentArticleDetail = null;
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

  async onView_article(params: any): Promise<ToolCallResult<any>> {
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
      this.reactive.currentArticleDetail = detail;
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

  async onNavigate_page(params: any): Promise<ToolCallResult<any>> {
    if (!this.reactive.currentResults) {
      return {
        success: false,
        data: { error: 'No search results to navigate' },
        summary: '[Bibliography] 错误: 无搜索结果',
      };
    }

    if (!this.reactive.currentSearchParams) {
      return {
        success: false,
        data: { error: 'No search parameters available for navigation' },
        summary: '[Bibliography] 错误: 无搜索参数',
      };
    }

    const { direction } = params;
    const totalPages = this.reactive.currentResults.totalPages || 1;

    if (direction === 'next') {
      if (this.reactive.currentPage >= totalPages) {
        return {
          success: false,
          data: { error: 'Already on the last page' },
          summary: '[Bibliography] 已是最后一页',
        };
      }
      this.reactive.currentPage++;
    } else if (direction === 'prev') {
      if (this.reactive.currentPage <= 1) {
        return {
          success: false,
          data: { error: 'Already on the first page' },
          summary: '[Bibliography] 已是第一页',
        };
      }
      this.reactive.currentPage--;
    } else {
      return {
        success: false,
        data: { error: 'Invalid direction. Use "next" or "prev"' },
        summary: '[Bibliography] 错误: 无效方向',
      };
    }

    const searchParams: PubmedSearchParams = {
      ...this.reactive.currentSearchParams,
      page: this.reactive.currentPage,
    };

    try {
      const results = await this.pubmedService.searchByPattern(searchParams);
      this.reactive.currentResults = {
        totalResults: results.totalResults,
        totalPages: results.totalPages,
        articleProfiles: results.articleProfiles,
      };
      this.reactive.currentArticleDetail = null;
      return {
        success: true,
        data: { page: this.reactive.currentPage, totalPages },
        summary: `[Bibliography] flip: 第 ${this.reactive.currentPage} / ${totalPages} 页`,
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

  onClear_results(): ToolCallResult<any> {
    this.reactive.currentResults = null;
    this.reactive.currentArticleDetail = null;
    this.reactive.currentPage = 1;
    this.reactive.currentRetrivalStrategy = null;
    this.reactive.currentSearchParams = null;
    return {
      success: true,
      data: { cleared: true },
      summary: '[Bibliography] 已清除结果',
    };
  }

  onSave_article(params: any): ToolCallResult<any> {
    const { pmid, note } = params;

    if (!pmid) {
      return {
        success: false,
        data: { error: 'PMID is required' },
        summary: '[Bibliography] 错误: 未提供 PMID',
      };
    }

    let articleToSave: SavedArticle | null = null;

    const existingArticle = this.reactive.savedArticles.get(pmid);

    if (this.reactive.currentResults) {
      articleToSave =
        this.reactive.currentResults.articleProfiles.find(
          (a) => a.pmid === pmid,
        ) ?? null;
    }

    if (
      !articleToSave &&
      this.reactive.currentArticleDetail &&
      this.reactive.currentArticleDetail.pmid === pmid
    ) {
      articleToSave = {
        doi: null,
        pmid: this.reactive.currentArticleDetail.pmid,
        title: this.reactive.currentArticleDetail.title,
        authors:
          this.reactive.currentArticleDetail.authors
            ?.map((a) => a.name)
            .join(', ') || '',
        journalCitation:
          this.reactive.currentArticleDetail.journalInfo?.title || '',
        snippet: this.reactive.currentArticleDetail.abstract,
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

    if (existingArticle && !note) {
      articleToSave.note = existingArticle.note;
    } else {
      articleToSave.note = note;
    }

    this.reactive.savedArticles.set(pmid, articleToSave);
    return {
      success: true,
      data: {
        pmid,
        title: articleToSave.title,
        note: articleToSave.note,
        totalFavorites: this.reactive.savedArticles.size,
      },
      summary: `[Bibliography] 已收藏: ${articleToSave.title?.substring(0, 30) || pmid}...`,
    };
  }

  onRemove_from_favorites(params: any): ToolCallResult<any> {
    const { pmid } = params;

    if (!pmid) {
      return {
        success: false,
        data: { error: 'PMID is required' },
        summary: '[Bibliography] 错误: 未提供 PMID',
      };
    }

    if (!this.reactive.savedArticles.has(pmid)) {
      return {
        success: false,
        data: { error: 'Article not in favorites' },
        summary: '[Bibliography] 错误: 该文献不在收藏夹中',
      };
    }

    const removed = this.reactive.savedArticles.get(pmid);
    this.reactive.savedArticles.delete(pmid);
    return {
      success: true,
      data: {
        pmid,
        removedTitle: removed?.title,
        remainingFavorites: this.reactive.savedArticles.size,
      },
      summary: `[Bibliography] 已取消收藏: ${removed?.title?.substring(0, 30) || pmid}...`,
    };
  }

  onGet_favorites(_params: any): ToolCallResult<any> {
    const favorites = Array.from(this.reactive.savedArticles.entries()).map(
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
        total: this.reactive.savedArticles.size,
      },
      summary: `[Bibliography] 收藏夹: ${this.reactive.savedArticles.size} 篇文献`,
    };
  }

  onUpdate_article_note(params: any): ToolCallResult<any> {
    const { pmid, note } = params;

    if (!pmid) {
      return {
        success: false,
        data: { error: 'PMID is required' },
        summary: '[Bibliography] 错误: 未提供 PMID',
      };
    }

    const article = this.reactive.savedArticles.get(pmid);
    if (!article) {
      return {
        success: false,
        data: { error: 'Article not in favorites' },
        summary: '[Bibliography] 错误: 该文献不在收藏夹中',
      };
    }

    article.note = note || undefined;
    this.reactive.savedArticles.set(pmid, article);

    return {
      success: true,
      data: { pmid, note: article.note },
      summary: `[Bibliography] 已更新备注: ${article.title?.substring(0, 30) || pmid}`,
    };
  }

  override async exportData(options?: ExportOptions) {
    const s = this.snapshot;
    return {
      data: {
        currentResults: s.currentResults,
        currentArticleDetail: s.currentArticleDetail,
        currentPage: s.currentPage,
        currentRetrivalStrategy: s.currentRetrivalStrategy,
        currentSearchParams: s.currentSearchParams,
        savedArticles: Array.from(s.savedArticles.entries()),
      },
      format: options?.format ?? 'json',
      metadata: {
        componentId: this.componentId,
        exportedAt: new Date().toISOString(),
      },
    };
  }
}
