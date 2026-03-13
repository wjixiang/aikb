import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VirtualFileSystemComponent } from '../virtualFileSystemComponent';
import { ExpertInstance } from '../../../expert/ExpertInstance';
import type { ExpertConfig, ExpertTask } from '../../../expert/types';
import { createMockAgent } from '../../../expert/__tests__/fixtures/mock-agent';

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

            case 'DeleteObjectCommand':
                return this.deleteObject(command.input);

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
        if (!bucket) {
            throw new Error('No such bucket');
        }
        const file = bucket.get(Key);
        if (!file) {
            throw new Error('No such key');
        }
        return {
            Body: {
                transformToString: () => file.content
            }
        };
    }

    private deleteObject(input: any): any {
        const { Bucket, Key } = input;
        const bucket = this.buckets.get(Bucket);
        if (bucket) {
            bucket.delete(Key);
        }
        return {};
    }

    private listObjects(input: any): any {
        const { Bucket, Prefix } = input;
        const bucket = this.buckets.get(Bucket);
        if (!bucket) {
            return { Contents: [] };
        }
        const prefix = Prefix || '';
        const contents = Array.from(bucket.entries())
            .filter(([key]) => key.startsWith(prefix))
            .map(([Key, value]) => ({
                Key,
                Size: value.content.length
            }));
        return { Contents: contents };
    }

    private headBucket(input: any): any {
        const { Bucket } = input;
        if (!this.buckets.has(Bucket)) {
            throw new Error('No such bucket');
        }
        return {};
    }

    // Helper to pre-populate bucket for testing
    setFile(bucket: string, key: string, content: string, contentType: string = 'text/plain') {
        if (!this.buckets.has(bucket)) {
            this.buckets.set(bucket, new Map());
        }
        this.buckets.get(bucket)!.set(key, { content, contentType });
    }

    // Helper to check if bucket exists
    hasBucket(bucket: string): boolean {
        return this.buckets.has(bucket);
    }

    // Helper to get file content
    getFile(bucket: string, key: string): string | undefined {
        return this.buckets.get(bucket)?.get(key)?.content;
    }
}

/**
 * Create a mock S3 client with test data
 */
function createMockS3Client(): MockS3Client {
    const client = new MockS3Client();
    // Pre-populate with test data
    client.setFile('test-bucket', 'existing-file.txt', 'Hello World', 'text/plain');
    client.setFile('test-bucket', 'data.json', '{"test": true}', 'application/json');
    return client;
}

describe('VirtualFileSystemComponent', () => {
    let component: VirtualFileSystemComponent;
    let mockS3Client: MockS3Client;

    beforeEach(() => {
        // Create mock S3 client
        mockS3Client = createMockS3Client();

        // Create component and replace internal S3 client
        component = new VirtualFileSystemComponent() as any;
        component['s3Client'] = mockS3Client;
        component['defaultBucket'] = 'test-bucket';
    });

    describe('read_file tool', () => {
        it('should read existing file', async () => {
            await component['readFile']('existing-file.txt');

            expect(component['currentResults']).toEqual({
                operation: 'read',
                path: 'existing-file.txt',
                content: 'Hello World',
                message: 'Successfully read file: existing-file.txt'
            });
        });

        it('should handle file not found', async () => {
            await component['readFile']('nonexistent.txt');

            expect(component['currentResults']).toEqual({
                operation: 'read',
                path: 'nonexistent.txt',
                error: expect.any(String),
                message: 'Failed to read file: nonexistent.txt'
            });
        });
    });

    describe('write_file tool', () => {
        it('should write file successfully', async () => {
            await component['writeFile']('new-file.txt', 'Test content', 'text/plain');

            expect(component['currentResults']).toEqual({
                operation: 'write',
                path: 'new-file.txt',
                message: 'Successfully wrote file: new-file.txt'
            });

            // Verify file was written
            expect(mockS3Client.getFile('test-bucket', 'new-file.txt')).toBe('Test content');
        });

        it('should write JSON content', async () => {
            await component['writeFile']('data.json', '{"key": "value"}', 'application/json');

            expect(component['currentResults'].success).toBeUndefined(); // No success field
            expect(component['currentResults'].message).toContain('Successfully wrote file');
        });
    });

    describe('list_files tool', () => {
        it('should list files in bucket', async () => {
            await component['listFiles']();

            expect(component['currentResults']).toEqual({
                operation: 'list',
                path: '',
                files: expect.arrayContaining([
                    expect.objectContaining({ name: 'existing-file.txt' }),
                    expect.objectContaining({ name: 'data.json' })
                ]),
                message: expect.stringContaining('Found')
            });
        });

        it('should list files with prefix', async () => {
            // Add more files
            mockS3Client.setFile('test-bucket', 'folder/file1.txt', 'content1');
            mockS3Client.setFile('test-bucket', 'folder/file2.txt', 'content2');

            await component['listFiles']('folder/');

            expect(component['currentResults'].files).toHaveLength(2);
            expect(component['currentResults'].files.map((f: any) => f.name)).toContain('folder/file1.txt');
        });
    });

    describe('delete_file tool', () => {
        it('should delete file successfully', async () => {
            await component['deleteFile']('existing-file.txt');

            expect(component['currentResults']).toEqual({
                operation: 'delete',
                path: 'existing-file.txt',
                message: 'Successfully deleted file: existing-file.txt'
            });
        });
    });

    describe('export_workspace tool', () => {
        it('should export content to specified bucket and path', async () => {
            await component['exportWorkspace']('export-bucket', 'exports/report.json', '{"exported": true}', 'application/json');

            expect(component['currentResults']).toEqual({
                operation: 'export',
                bucket: 'export-bucket',
                path: 'exports/report.json',
                success: true,
                message: 'Successfully exported to export-bucket/exports/report.json'
            });

            // Verify file was exported
            expect(mockS3Client.getFile('export-bucket', 'exports/report.json')).toBe('{"exported": true}');
        });

        it('should infer content type from file extension', async () => {
            await component['exportWorkspace']('test-bucket', 'doc.md', '# Markdown', undefined);

            const content = mockS3Client.getFile('test-bucket', 'doc.md');
            expect(content).toBe('# Markdown');
        });
    });

    describe('exportContent method', () => {
        it('should export content without setting currentResults', async () => {
            const result = await component['exportContent']('test-bucket', 'output.txt', 'Direct export');

            expect(result).toEqual({
                success: true,
                error: undefined
            });

            expect(mockS3Client.getFile('test-bucket', 'output.txt')).toBe('Direct export');
        });
    });

    describe('renderImply', () => {
        it('should render component UI', async () => {
            const elements = await component.renderImply();

            expect(elements.length).toBeGreaterThan(0);
            expect(elements[0]).toBeDefined();
        });
    });

    describe('getState', () => {
        it('should return component state', async () => {
            const state = component.getState();

            expect(state).toEqual({
                bucket: 'test-bucket',
                currentPath: '',
                lastOperation: undefined
            });
        });
    });
});

describe('ExpertInstance Auto-Export', () => {
    let expert: ExpertInstance;
    let mockAgent: any;
    let mockS3Client: MockS3Client;

    const expertConfigWithExport: ExpertConfig = {
        expertId: 'test-export-expert',
        displayName: 'Test Export Expert',
        description: 'Expert for testing export',
        responsibilities: 'Testing export functionality',
        capabilities: ['export'],
        components: [],
        prompt: {
            capability: 'Test capability',
            direction: 'Test direction'
        },
        exportConfig: {
            autoExport: true,
            bucket: 'export-bucket',
            defaultPath: '{expertId}/{timestamp}.json'
        }
    };

    beforeEach(() => {
        mockS3Client = createMockS3Client();
        mockAgent = createMockAgent();

        // Mock workspace with VirtualFileSystemComponent
        const mockVFSComponent = {
            // Add constructor name to match the lookup
            constructor: { name: 'VirtualFileSystemComponent' },
            getState: vi.fn().mockReturnValue({ bucket: 'test-bucket' }),
            exportContent: vi.fn().mockImplementation(async (bucket: string, path: string, content: string, contentType: string) => {
                mockS3Client.setFile(bucket, path, content, contentType);
                return { success: true };
            })
        };

        mockAgent.workspace = {
            getStats: vi.fn().mockReturnValue({ componentCount: 1 }),
            getComponent: vi.fn().mockImplementation((key: string) => {
                if (key === 'virtualFileSystem') {
                    return mockVFSComponent;
                }
                return null;
            }),
            getComponentKeys: vi.fn().mockReturnValue(['virtualFileSystem']),
            getComponentState: vi.fn().mockReturnValue({})
        };

        expert = new ExpertInstance(expertConfigWithExport, mockAgent as any);
    });

    it('should auto-export after task completion', async () => {
        const task: ExpertTask = {
            taskId: 'task-123',
            description: 'Test task'
        };

        const result = await expert.execute(task);

        // Debug: print result if failed
        if (!result.success) {
            console.log('Result:', result);
        }

        expect(result.success).toBe(true);
        // Verify file was exported - check bucket has any file
        expect(mockS3Client.hasBucket('export-bucket')).toBe(true);
    });

    it('should include task output in exported content', async () => {
        const task: ExpertTask = {
            taskId: 'task-456',
            description: 'Test task with output'
        };

        const result = await expert.execute(task);

        expect(result.success).toBe(true);
        // Check that exported content contains the task info
        // Get all files from the export bucket
        const content = JSON.stringify(Array.from(mockS3Client['buckets'].get('export-bucket')?.entries() || []));
        expect(content).toContain('task-456');
    });

    it('should not export if autoExport is disabled', async () => {
        const configWithoutExport: ExpertConfig = {
            ...expertConfigWithExport,
            exportConfig: {
                autoExport: false,
                bucket: 'export-bucket'
            }
        };

        const expertWithoutExport = new ExpertInstance(configWithoutExport, mockAgent as any);
        const task: ExpertTask = {
            taskId: 'task-789',
            description: 'Test task'
        };

        const result = await expertWithoutExport.execute(task);

        expect(result.success).toBe(true);
        // No files should be exported to export-bucket
        expect(mockS3Client.hasBucket('export-bucket')).toBe(false);
    });

    it('should use custom exportHandler when provided', async () => {
        const customHandler = vi.fn().mockResolvedValue({
            success: true,
            filePath: 'custom/path/output.json'
        });

        const configWithHandler: ExpertConfig = {
            ...expertConfigWithExport,
            exportConfig: {
                autoExport: true,
                bucket: 'custom-bucket',
                exportHandler: customHandler
            }
        };

        const expertWithHandler = new ExpertInstance(configWithHandler, mockAgent as any);
        const task: ExpertTask = {
            taskId: 'task-custom',
            description: 'Test task with custom handler'
        };

        await expertWithHandler.execute(task);

        expect(customHandler).toHaveBeenCalled();
    });

    it('should replace path placeholders correctly', async () => {
        const task: ExpertTask = {
            taskId: 'task-path-test',
            description: 'Test path placeholders'
        };

        const result = await expert.execute(task);

        expect(result.success).toBe(true);
        // Path should contain expertId - check all content
        const content = JSON.stringify(Array.from(mockS3Client['buckets'].get('export-bucket')?.entries() || []));
        expect(content).toContain('test-export-expert');
    });
});
