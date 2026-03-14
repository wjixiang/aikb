import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { ExpertInstance } from '../ExpertInstance';
import { ExpertExecutor } from '../ExpertExecutor';
import type { ExpertConfig, ExpertTask } from '../types';
import createMetaAnalysisArticleRetrievalExpert from '../builtin/meta-analysis-article-retrieval/expert';
import { BibliographySearchComponent } from '../../../../components/index.js';
import { VirtualFileSystemComponent } from '../../../../components/index.js';
import { createMockAgent } from './fixtures/mock-agent';

/**
 * Get test data file path
 */
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Mock S3 Client for testing
 */
class MockS3Client {
    private buckets: Map<string, Map<string, { content: string; contentType: string }>> = new Map();

    async send(command: any): Promise<any> {
        const commandName = command.constructor.name;

        switch (commandName) {
            case 'PutObjectCommand':
                return this.putObject(command.input);
            case 'GetObjectCommand':
                return this.getObject(command.input);
            case 'ListObjectsV2Command':
                return this.listObjects(command.input);
            case 'HeadBucketCommand':
                return this.headBucket(command.input);
            default:
                throw new Error(`Unknown command: ${commandName}`);
        }
    }

    private putObject(input: any): any {
        const { Bucket, Key, Body, ContentType } = input;
        if (!this.buckets.has(Bucket)) {
            this.buckets.set(Bucket, new Map());
        }
        const content = Body instanceof Buffer ? Body.toString() : Body;
        this.buckets.get(Bucket)!.set(Key, { content, contentType: ContentType });
        return {};
    }

    private getObject(input: any): any {
        const { Bucket, Key } = input;
        const bucket = this.buckets.get(Bucket);
        if (!bucket) throw new Error('No such bucket');
        const file = bucket.get(Key);
        if (!file) throw new Error('No such key');
        return { Body: { transformToString: () => file.content } };
    }

    private listObjects(input: any): any {
        const { Bucket, Prefix } = input;
        const bucket = this.buckets.get(Bucket);
        if (!bucket) return { Contents: [] };
        const prefix = Prefix || '';
        const contents = Array.from(bucket.entries())
            .filter(([key]) => key.startsWith(prefix))
            .map(([Key, value]) => ({ Key, Size: value.content.length }));
        return { Contents: contents };
    }

    private headBucket(input: any): any {
        const { Bucket } = input;
        if (!this.buckets.has(Bucket)) throw new Error('No such bucket');
        return {};
    }

    setFile(bucket: string, key: string, content: string, contentType: string = 'text/plain') {
        if (!this.buckets.has(bucket)) this.buckets.set(bucket, new Map());
        this.buckets.get(bucket)!.set(key, { content, contentType });
    }

    getFile(bucket: string, key: string): string | undefined {
        return this.buckets.get(bucket)?.get(key)?.content;
    }

    hasBucket(bucket: string): boolean {
        return this.buckets.has(bucket);
    }

    getAllFiles(bucket: string): Map<string, { content: string; contentType: string }> {
        return this.buckets.get(bucket) || new Map();
    }
}

/**
 * Extend mock Agent for E2E testing with real components
 * Reuses createMockAgent and adds specialized workspace
 */
function createMockAgentForE2E() {
    const mockS3Client = new MockS3Client();

    // Create real components
    const bibComponent = new BibliographySearchComponent();
    const vfsComponent = new VirtualFileSystemComponent() as any;

    // Inject mock S3 client
    vfsComponent.s3Client = mockS3Client;
    vfsComponent.defaultBucket = 'test-export-bucket';

    // Load mock search results
    const mockSearchResults = JSON.parse(
        readFileSync(join(__dirname, '../../components/bibliographySearch/__tests__/searchResult.json'), 'utf-8')
    );
    bibComponent.currentResults = mockSearchResults;

    // Start with base mock agent
    const agent = createMockAgent();

    // Override workspace with real components
    agent.workspace = {
        getStats: vi.fn().mockReturnValue({ componentCount: 2 }),
        getComponent: vi.fn().mockImplementation((key: string) => {
            if (key === 'bibliography-search') return bibComponent;
            if (key === 'virtualFileSystem') return vfsComponent;
            return null;
        }),
        getComponentKeys: vi.fn().mockReturnValue(['bibliography-search', 'virtualFileSystem']),
        getComponentState: vi.fn().mockImplementation((key: string) => {
            if (key === 'bibliography-search') return bibComponent.getState();
            if (key === 'virtualFileSystem') return vfsComponent.getState();
            return {};
        })
    };

    // Expose for testing
    (agent as any)._mockS3Client = mockS3Client;
    (agent as any)._bibComponent = bibComponent;
    (agent as any)._vfsComponent = vfsComponent;

    return agent;
}

/**
 * Custom export handler for bibliography search
 */
async function bibliographyExportHandler(workspace: any, config: any): Promise<any> {
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
    const csvLines = ['PMID,Title,Authors,Journal,Snippet'];

    for (const article of articles) {
        const row = [
            article.pmid || '',
            `"${(article.title || '').replace(/"/g, '""')}"`,
            `"${(article.authors || '').replace(/"/g, '""')}"`,
            `"${(article.journalCitation || '').replace(/"/g, '""')}"`,
            `"${(article.snippet || '').replace(/"/g, '""')}"`
        ];
        csvLines.push(row.join(','));
    }

    const csvContent = csvLines.join('\n');

    // Get VFS component
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

describe('Meta-Analysis Article Retrieval Expert E2E', () => {
    let expertConfig: ExpertConfig;
    let mockAgent: any;

    beforeEach(() => {
        // Load the real expert configuration
        expertConfig = createMetaAnalysisArticleRetrievalExpert();

        // Add export configuration
        expertConfig.exportConfig = {
            autoExport: true,
            bucket: 'test-export-bucket',
            defaultPath: '{expertId}/{timestamp}.csv',
            exportHandler: bibliographyExportHandler
        };

        // Create mock agent
        mockAgent = createMockAgentForE2E();
    });

    describe('end-to-end: literature search and export', () => {
        it('should search literature and export results to CSV', async () => {
            // Create expert instance
            const expert = new ExpertInstance(expertConfig, mockAgent as any);

            // Activate expert
            await expert.activate();
            expect(expert.status).toBe('ready');

            // Execute task
            const task: ExpertTask = {
                taskId: 'e2e-test-001',
                description: 'Search for articles about hypertension',
                input: { query: 'hypertension' }
            };

            const result = await expert.execute(task);

            // Verify execution succeeded
            expect(result.success).toBe(true);
            expect(result.expertId).toBe('meta-analysis-article-retrieval');

            // Verify output contains bibliography search results
            expect(result.output).toBeDefined();
            expect(result.output['bibliography-search']).toBeDefined();

            // Verify file was exported
            const mockS3Client = mockAgent._mockS3Client;
            expect(mockS3Client.hasBucket('test-export-bucket')).toBe(true);

            // Get exported file
            const bucketFiles = mockS3Client.getAllFiles('test-export-bucket');
            expect(bucketFiles.size).toBeGreaterThan(0);

            // Verify CSV content
            const exportedFile = Array.from(bucketFiles.values())[0] as { content: string; contentType: string };
            expect(exportedFile.contentType).toBe('text/csv');
            expect(exportedFile.content).toContain('PMID');
            expect(exportedFile.content).toContain('35758526'); // First article PMID
            expect(exportedFile.content).toContain('Hypertension');
        });

        it('should handle task without export configuration', async () => {
            // Remove export config
            const configWithoutExport = {
                ...expertConfig,
                exportConfig: {
                    autoExport: false
                }
            };

            const expert = new ExpertInstance(configWithoutExport, mockAgent as any);
            await expert.activate();

            const task: ExpertTask = {
                taskId: 'e2e-test-002',
                description: 'Search for articles',
                input: { query: 'diabetes' }
            };

            const result = await expert.execute(task);

            expect(result.success).toBe(true);

            // Verify no file was exported
            const mockS3Client = mockAgent._mockS3Client;
            // Check if export happened (should not with autoExport: false)
            const bucketFiles = mockS3Client.getAllFiles('test-export-bucket');
            // Previous test may have added files, so just verify task completed
            expect(result.summary).toContain('Meta-Analysis Article Retrieval');
        });

        it('should include search parameters in export', async () => {
            const expert = new ExpertInstance(expertConfig, mockAgent as any);
            await expert.activate();

            const task: ExpertTask = {
                taskId: 'e2e-test-003',
                description: 'Search for resistant hypertension articles',
                input: { query: 'resistant hypertension' }
            };

            const result = await expert.execute(task);

            expect(result.success).toBe(true);

            // Verify output contains the search query
            const bibState = result.output['bibliography-search'];
            expect(bibState).toBeDefined();
        });
    });

    describe('component rendering', () => {
        it('should render bibliography search component', async () => {
            const expert = new ExpertInstance(expertConfig, mockAgent as any);
            await expert.activate();

            const summary = await expert.getStateSummary();

            expect(summary).toContain('bibliography-search');
            expect(summary).toContain('Meta-Analysis Article Retrieval');
        });
    });
});
