# Export Format Removal Plan

## Overview

移除 `format` 配置项，让导出逻辑完全由 `exportHandler` 控制。这样可以：
1. 支持任意导出格式（CSV、Excel、XML 等）
2. 简化配置接口
3. 提供更大的灵活性

## Current State

### ExpertExportConfig (types.ts:84-102)

```typescript
export interface ExpertExportConfig {
    autoExport?: boolean;
    bucket?: string;
    defaultPath?: string;
    format?: 'json' | 'markdown' | 'text';  // <-- 移除
    exportHandler?: (workspace: any, config: ExportConfig) => Promise<ExportResult>;
}
```

### ExportConfig (types.ts:107-111)

```typescript
export interface ExportConfig {
    bucket: string;
    path: string;
    format?: 'json' | 'markdown' | 'text';  // <-- 移除
}
```

### performAutoExport (ExpertInstance.ts:239-295)

当前逻辑：
1. 获取 format（默认 'json'）
2. 替换路径中的 `{format}` 占位符
3. 传递 format 给 exportHandler
4. 根据 format 确定 contentType

## Proposed Changes

### 1. ExpertExportConfig - 移除 format 字段

```typescript
export interface ExpertExportConfig {
    /** Whether to auto-export after task completion */
    autoExport?: boolean;
    /** Default bucket for export */
    bucket?: string;
    /** 
     * Default path template 
     * Supports placeholders: {expertId}, {timestamp}, {taskId}
     * Note: Format extension should be included in the path
     */
    defaultPath?: string;
    /**
     * Custom export handler
     * Full control over:
     * - Export format (via file extension in path)
     * - Content type
     * - Export logic
     */
    exportHandler?: (workspace: any, config: ExportConfig) => Promise<ExportResult>;
}
```

### 2. ExportConfig - 移除 format 字段

```typescript
export interface ExportConfig {
    bucket: string;
    path: string;
    // format removed - handler has full control
}
```

### 3. ExportResult - 添加 contentType 字段

```typescript
export interface ExportResult {
    success: boolean;
    filePath?: string;
    url?: string;
    contentType?: string;  // NEW: Record what was exported
    error?: string;
}
```

### 4. performAutoExport - 简化逻辑

```typescript
private async performAutoExport(task: ExpertTask, output: any): Promise<ExportResult> {
    const exportConfig = this.config.exportConfig;
    if (!exportConfig) {
        return { success: false, error: 'No export config' };
    }

    // Get export parameters
    const bucket = exportConfig.bucket || process.env['FS_BUCKET'] || 'agentfs';

    // Generate path with placeholders (no format placeholder)
    let path = exportConfig.defaultPath || '{expertId}/{timestamp}.json';
    path = path
        .replace('{expertId}', this.expertId)
        .replace('{taskId}', task.taskId || 'unknown')
        .replace('{timestamp}', new Date().toISOString().replace(/[:.]/g, '-'));

    // Use custom handler or default JSON export
    if (exportConfig.exportHandler) {
        return exportConfig.exportHandler(this.agent.workspace, { bucket, path });
    }

    // Default: export all component states as JSON
    const content = JSON.stringify({
        expertId: this.expertId,
        taskId: task.taskId,
        taskDescription: task.description,
        output: output,
        artifacts: this.artifacts,
        timestamp: new Date().toISOString(),
    }, null, 2);

    // Get VirtualFileSystemComponent and export
    const vfsComponent = this.getVirtualFileSystemComponent();
    if (!vfsComponent) {
        return { success: false, error: 'VirtualFileSystemComponent not found' };
    }

    // Default to JSON content type
    const contentType = 'application/json';
    return vfsComponent.exportContent(bucket, path, content, contentType);
}
```

## Migration Guide

### Before

```typescript
const expert = new ExpertInstance({
    expertId: 'meta-analysis-article-retrieval',
    exportConfig: {
        autoExport: true,
        format: 'csv',  // Will be removed
        defaultPath: '{expertId}/{taskId}/output.{format}',
        exportHandler: csvExportHandler
    }
});
```

### After

```typescript
const expert = new ExpertInstance({
    expertId: 'meta-analysis-article-retrieval',
    exportConfig: {
        autoExport: true,
        defaultPath: '{expertId}/{taskId}/output.csv',  // Include extension directly
        exportHandler: csvExportHandler
    }
});
```

## CSV Export Handler Example

```typescript
import type { VirtualWorkspace } from '../statefulContext/virtualWorkspace.js';
import type { ExportConfig, ExportResult } from './types.js';

/**
 * CSV export handler for meta-analysis article retrieval
 */
export async function csvExportHandler(
    workspace: VirtualWorkspace,
    config: ExportConfig
): Promise<ExportResult> {
    // 1. Get BibliographySearchComponent
    const component = workspace.getComponent('bibliography-search');
    if (!component) {
        return { success: false, error: 'BibliographySearchComponent not found' };
    }

    const bibComponent = component as any;
    const articles = bibComponent.currentResults?.articleProfiles || [];
    const strategy = bibComponent.currentRetrivalStrategy;
    const searchParams = bibComponent.currentSearchParams;

    if (articles.length === 0) {
        return { success: false, error: 'No articles to export' };
    }

    // 2. Generate CSV content
    const csvContent = generateArticleCSV(articles, strategy, searchParams);

    // 3. Get VFS component
    const vfsComponent = getVFSComponent(workspace);
    if (!vfsComponent) {
        return { success: false, error: 'VirtualFileSystemComponent not found' };
    }

    // 4. Export with CSV content type
    const result = await vfsComponent.exportContent(
        config.bucket,
        config.path,
        csvContent,
        'text/csv'
    );

    return {
        ...result,
        contentType: 'text/csv'
    };
}

function generateArticleCSV(
    articles: any[],
    strategy?: any,
    searchParams?: any
): string {
    // CSV headers
    const headers = [
        'PMID',
        'Title',
        'Authors',
        'Journal',
        'Publication Year',
        'DOI',
        'Keywords',
        'Search Query'
    ];

    const rows = [headers.join(',')];

    // Data rows
    for (const article of articles) {
        const authors = (article.authors || [])
            .map((a: any) => a.lastName || a.name)
            .join('; ');

        const keywords = (article.keywords || [])
            .map((k: any) => k.name || k)
            .join('; ');

        const row = [
            article.pmid || '',
            `"${(article.title || '').replace(/"/g, '""')}"`,
            `"${authors.replace(/"/g, '""')}"`,
            `"${(article.journal || '').replace(/"/g, '""')}"`,
            article.publicationYear || '',
            article.doi || '',
            `"${keywords.replace(/"/g, '""')}"`,
            `"${(searchParams?.query || '').replace(/"/g, '""')}"`
        ];
        rows.push(row.join(','));
    }

    return rows.join('\n');
}

function getVFSComponent(workspace: any): any {
    const keys = workspace.getComponentKeys();
    for (const key of keys) {
        const comp = workspace.getComponent(key);
        if (comp && comp.constructor.name === 'VirtualFileSystemComponent') {
            return comp;
        }
    }
    return null;
}
```

## Files to Modify

| File | Changes |
|------|---------|
| `libs/agent-lib/src/expert/types.ts` | Remove `format` from `ExpertExportConfig` and `ExportConfig`, add `contentType` to `ExportResult` |
| `libs/agent-lib/src/expert/ExpertInstance.ts` | Simplify `performAutoExport`, remove format-related logic |
| `libs/agent-lib/src/expert/exportHandlers/csvExport.ts` | NEW: CSV export handler implementation |

## Benefits

1. **灵活性**: 支持任意导出格式
2. **简化**: 减少配置项，降低复杂度
3. **清晰**: 导出逻辑完全由 handler 控制，职责明确
4. **可扩展**: 轻松添加新的导出格式（Excel、XML 等）

## Backward Compatibility

这是一个 breaking change。现有使用 `format` 配置的代码需要更新：
- 将 `{format}` 占位符替换为具体的文件扩展名
- 移除 `format` 配置项
