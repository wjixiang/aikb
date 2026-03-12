import type { ExportConfig, ExportResult } from '../../types.js';

/**
 * Export handler for meta-analysis-article-retrieval expert
 *
 * Exports search results as CSV format with article details
 */
export async function metaAnalysisArticleRetrievalExportHandler(
    workspace: any,
    config: ExportConfig
): Promise<ExportResult> {
    // Get bibliography search component
    const component = workspace.getComponent('bibliography-search');
    if (!component) {
        return { success: false, error: 'BibliographySearchComponent not found' };
    }

    const bibComponent = component as any;
    const results = bibComponent.currentResults;

    if (!results || !results.articleProfiles) {
        return { success: false, error: 'No search results to export' };
    }

    // Export as CSV format
    const articles = results.articleProfiles;
    const csvLines = [
        'PMID,Title,Authors,Journal,Publication Year,DOI,Keywords,Search Query'
    ];

    for (const article of articles) {
        const authors = (article.authors || '')
            .replace(/"/g, '""');
        const title = (article.title || '')
            .replace(/"/g, '""');
        const journal = (article.journalCitation || '')
            .replace(/"/g, '""');

        // Extract year from journal citation if available
        const yearMatch = article.journalCitation?.match(/\b(19|20)\d{2}\b/);
        const year = yearMatch ? yearMatch[0] : '';

        // Extract DOI if available
        const doiMatch = article.journalCitation?.match(/doi:\s*(10\.\S+)/);
        const doi = doiMatch ? doiMatch[1] : '';

        // Extract keywords from snippet if available
        const keywords = (article.snippet || '')
            .split(',')
            .slice(0, 5)
            .join('; ');

        const row = [
            article.pmid || '',
            `"${title}"`,
            `"${authors}"`,
            `"${journal}"`,
            year,
            doi,
            `"${keywords}"`,
            `"${bibComponent.currentSearchParams?.query || ''}"`
        ];
        csvLines.push(row.join(','));
    }

    const csvContent = csvLines.join('\n');

    // Get VirtualFileSystemComponent
    const vfsComponent = workspace.getComponent('virtualFileSystem');
    if (!vfsComponent) {
        return { success: false, error: 'VirtualFileSystemComponent not found' };
    }

    const exportResult = await vfsComponent.exportContent(
        config.bucket,
        config.path,
        csvContent,
        'text/csv'
    );

    return {
        ...exportResult,
        contentType: 'text/csv'
    };
}
