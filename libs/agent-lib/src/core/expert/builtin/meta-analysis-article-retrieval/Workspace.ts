/**
 * Meta-Analysis Article Retrieval Workspace Module
 *
 * 职责：
 * 1. 导入和注册 BibliographySearchComponent
 * 2. 输入验证和转换
 * 3. CSV格式输出和导出
 */

import { ExpertWorkspaceBase, type ComponentDefinition } from '../../ExpertWorkspaceBase.js';
import type { IVirtualWorkspace } from '../../../../components/index.js';
import type { ValidationResult, ExportConfig, ExportResult } from '../../types.js';
import { BibliographySearchComponent } from '../../../../components/index.js';

/**
 * MetaAnalysisArticleRetrievalWorkspace
 *
 * 专门用于Meta-Analysis文献检索的工作空间
 */
export class MetaAnalysisArticleRetrievalWorkspace extends ExpertWorkspaceBase {

    // ==================== 组件定义 ====================

    /**
     * 获取带ID的组件列表
     * 使用 BibliographySearchComponent 进行 PubMed 检索
     * 使用 getComponentsWithIds 以保留组件ID（bibliography-search）
     */
    static override getComponentsWithIds(): ComponentDefinition[] {
        return [
            {
                id: 'bibliography-search',
                component: new BibliographySearchComponent(),
            },
        ];
    }

    // ==================== 输入处理 ====================

    /**
     * 验证输入参数
     * 
     * 必需字段：
     * - research_question: 临床问题或研究主题
     * 
     * 可选字段：
     * - databases: 检索数据库（默认PubMed）
     * - target_results_per_query: 每次查询目标结果数（默认100）
     * - priorArticles: 之前的文章S3 key数组
     */
    static override validateInput(input: Record<string, any>): ValidationResult {
        const errors: string[] = [];
        const warnings: string[] = [];

        // 必需字段：research_question
        if (!input['research_question']) {
            errors.push('research_question is required');
        }

        // 可选字段验证：databases
        if (input['databases'] && typeof input['databases'] !== 'string') {
            errors.push('databases must be a string');
        }

        // 可选字段验证：target_results_per_query
        if (input['target_results_per_query'] !== undefined) {
            const num = Number(input['target_results_per_query']);
            if (isNaN(num)) {
                errors.push('target_results_per_query must be a number');
            } else if (num < 1) {
                errors.push('target_results_per_query must be greater than 0');
            } else if (num > 1000) {
                warnings.push('target_results_per_query exceeds recommended limit of 1000');
            }
        }

        // 可选字段验证：priorArticles
        if (input['priorArticles'] && !Array.isArray(input['priorArticles'])) {
            errors.push('priorArticles must be an array of S3 keys');
        }

        return {
            valid: errors.length === 0,
            errors: errors.length > 0 ? errors : undefined,
            warnings: warnings.length > 0 ? warnings : undefined,
        };
    }

    /**
     * 转换输入格式
     * 添加默认值
     */
    static override transformInput(input: Record<string, any>): Record<string, any> {
        return {
            research_question: input['research_question']?.trim(),
            databases: input['databases'] || 'PubMed',
            target_results_per_query: input['target_results_per_query'] || 100,
            priorArticles: input['priorArticles'] || [],
        };
    }

    /**
     * 加载外部数据
     * 从S3加载priorArticles
     */
    static override async loadExternalData(
        input: Record<string, any>,
        context?: any
    ): Promise<Record<string, any>> {
        const s3Keys = input['priorArticles'] || [];

        if (s3Keys.length > 0 && context?.workspace) {
            const vfs = context.workspace.getComponent('virtualFileSystem');

            if (vfs) {
                const loadedData: Record<string, any> = {};

                for (const key of s3Keys) {
                    try {
                        const content = await vfs.readFile(key);
                        loadedData[key] = JSON.parse(content);
                    } catch (error) {
                        console.warn(`Failed to load external data from ${key}:`, error);
                    }
                }

                return { ...input, loadedPriorArticles: loadedData };
            }
        }

        return input;
    }

    // ==================== 输出处理 ====================

    /**
     * 导出处理
     * 将检索结果导出为CSV格式
     */
    static override async exportHandler(
        workspace: IVirtualWorkspace,
        config: ExportConfig
    ): Promise<ExportResult> {
        try {
            // 获取BibliographySearchComponent
            const component = workspace.getComponent('bibliography-search');
            if (!component) {
                return { success: false, error: 'BibliographySearchComponent not found' };
            }

            const bibComponent = component as any;
            const articles = bibComponent.currentResults?.articles || [];

            // 构建CSV内容
            const csvLines: string[] = [];

            // CSV Header
            csvLines.push([
                '"PMID"',
                '"Title"',
                '"Authors"',
                '"Journal"',
                '"Year"',
                '"DOI"',
                '"Keywords"',
                '"Search Query"'
            ].join(','));

            // CSV Rows
            for (const article of articles) {
                const authors = (article.authors || [])
                    .map((a: any) => a.lastname || a.name || '')
                    .filter(Boolean)
                    .join('; ');

                const keywords = (article.keywords || []).join('; ');

                const row = [
                    `"${article.pmid || ''}"`,
                    `"${(article.title || '').replace(/"/g, '""')}"`,
                    `"${authors.replace(/"/g, '""')}"`,
                    `"${(article.journal || '').replace(/"/g, '""')}"`,
                    `"${article.year || ''}"`,
                    `"${article.doi || ''}"`,
                    `"${keywords.replace(/"/g, '""')}"`,
                    `"${bibComponent.currentSearchParams?.query || ''}"`
                ];
                csvLines.push(row.join(','));
            }

            const csvContent = csvLines.join('\n');

            // 获取VirtualFileSystemComponent进行导出
            const vfsComponent = workspace.getComponent('virtualFileSystem');
            if (!vfsComponent) {
                return { success: false, error: 'VirtualFileSystemComponent not found' };
            }

            // 使用类型断言调用exportContent
            const exportResult = await (vfsComponent as any).exportContent(
                config.bucket,
                config.path,
                csvContent,
                'text/csv'
            );

            return {
                ...exportResult,
                contentType: 'text/csv'
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }
}
