/**
 * Meta-Analysis Article Retrieval Expert
 *
 * Factory function that creates ExpertConfig
 *
 * 使用简化架构：
 * - config.json: Expert元数据
 * - sop.yaml: 标准操作流程
 * - Workspace.ts: 工作空间（组件 + 输入/输出处理）
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import YAML from 'yaml';
import type { ExpertConfig, ExpertComponentDefinition } from '../../types.js';
import { TYPES } from '../../../di/types.js';
import type { ExportResult, ExportConfig } from '../../types.js';

// Get current file directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Load Expert metadata from config.json
 */
function loadConfig() {
    const configPath = join(__dirname, 'config.json');
    return JSON.parse(readFileSync(configPath, 'utf-8'));
}

/**
 * Load SOP definition from sop.yaml
 */
function loadSOP() {
    const sopPath = join(__dirname, 'sop.yaml');
    return YAML.parse(readFileSync(sopPath, 'utf-8'));
}

/**
 * Build Capability Prompt from SOP
 */
function buildCapability(sop: any): string {
    const parts: string[] = [];

    parts.push('## Overview\n' + sop.overview);

    if (sop.constraints?.length) {
        parts.push('## Constraints\n' + sop.constraints.map((c: string) => `- ${c}`).join('\n'));
    }

    return parts.join('\n\n');
}

/**
 * Build Direction Prompt from SOP
 */
function buildDirection(sop: any): string {
    const parts: string[] = [];

    // Steps
    if (sop.steps?.length) {
        parts.push('## Steps\n');
        for (const step of sop.steps) {
            parts.push(`### ${step.phase}\n${step.description}`);
            if (step.details) {
                parts.push(`\n${step.details}`);
            }
        }
    }

    // Examples
    if (sop.examples?.length) {
        parts.push('\n## Examples\n');
        for (const example of sop.examples) {
            parts.push(`**Input:**\n\`\`\`\n${example.input}\n\`\`\``);
            parts.push(`**Output:**\n\`\`\`\n${example.output}\n\`\`\``);
            if (example.description) {
                parts.push(example.description);
            }
        }
    }

    return parts.join('\n');
}

/**
 * Build Component Definitions
 */
function buildComponents(config: any): ExpertComponentDefinition[] {
    return (config.components || []).map((comp: any) => ({
        componentId: comp.id || comp.componentId,
        displayName: comp.displayName,
        description: comp.description,
        instance: TYPES[comp.diToken as keyof typeof TYPES] || comp.diToken,
        shared: comp.shared,
    }));
}

/**
 * Export Handler for CSV output
 */
async function exportHandler(workspace: any, config: ExportConfig): Promise<ExportResult> {
    // Get bibliography search component
    const component = workspace.getComponent('bibliography-search');
    if (!component) {
        return { success: false, error: 'BibliographySearchComponent not found' };
    }

    const bibComponent = component as any;
    const articles = bibComponent.currentResults?.articles || [];

    // Build CSV content
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

    // Get VirtualFileSystemComponent for export
    const vfsComponent = workspace.getComponent('virtualFileSystem');
    if (!vfsComponent) {
        return { success: false, error: 'VirtualFileSystemComponent not found' };
    }

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
}

/**
 * Input Handler
 */
const inputHandler = {
    validate: (input: any) => {
        const errors: string[] = [];
        const warnings: string[] = [];

        if (!input.research_question) {
            errors.push('research_question is required');
        }

        if (input.databases && typeof input.databases !== 'string') {
            errors.push('databases must be a string');
        }

        if (input.target_results_per_query !== undefined) {
            const num = Number(input.target_results_per_query);
            if (isNaN(num)) {
                errors.push('target_results_per_query must be a number');
            } else if (num < 1) {
                errors.push('target_results_per_query must be greater than 0');
            } else if (num > 1000) {
                warnings.push('target_results_per_query exceeds recommended limit of 1000');
            }
        }

        if (input.priorArticles && !Array.isArray(input.priorArticles)) {
            errors.push('priorArticles must be an array of S3 keys');
        }

        return {
            valid: errors.length === 0,
            errors: errors.length > 0 ? errors : undefined,
            warnings: warnings.length > 0 ? warnings : undefined,
        };
    },

    transform: (input: any) => ({
        research_question: input.research_question?.trim(),
        databases: input.databases || 'PubMed',
        target_results_per_query: input.target_results_per_query || 100,
        priorArticles: input.priorArticles || [],
    }),

    loadExternalData: async (input: any, context?: any) => {
        const s3Keys = input.priorArticles || [];

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
};

/**
 * Create Expert Configuration
 *
 * Factory function that creates ExpertConfig from config.json and sop.yaml
 */
export default function createMetaAnalysisArticleRetrievalExpert(): ExpertConfig {
    const config = loadConfig();
    const sop = loadSOP();

    return {
        // Basic metadata
        expertId: config.id,
        displayName: config.displayName,
        description: config.description || '',
        whenToUse: config.whenToUse,
        triggers: config.triggers,

        // Prompt (built from SOP)
        prompt: {
            capability: buildCapability(sop),
            direction: buildDirection(sop),
        },

        // Responsibilities and capabilities
        responsibilities: sop.responsibilities?.join('; ') || '',
        capabilities: config.tags || [],

        // Components
        components: buildComponents(config),

        // Input handler
        input: inputHandler,

        // Export configuration
        exportConfig: config.export ? {
            autoExport: config.export.autoExport,
            bucket: config.export.bucket,
            defaultPath: config.export.defaultPath,
            exportHandler: exportHandler,
        } : undefined,
    };
}
