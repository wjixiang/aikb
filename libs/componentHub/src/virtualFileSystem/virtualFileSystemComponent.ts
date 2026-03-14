/**
 * Virtual File System Component
 *
 * A ToolComponent that provides file system operations via S3 (rustfs)
 * This allows LLM to read/write files as if they were local files
 */

import { Tool, ToolComponent, TUIElement, tdiv, th, tp } from 'agent-lib/components/ui/index.js';
import {
    S3Client,
    S3ClientConfig,
    createS3Client,
    uploadFile,
    downloadFile,
    deleteFile,
    listFiles,
    bucketExists,
    getPresignedUrl,
} from 'agent-lib/components/utils/index.js';
import { readFileParams, writeFileParams, listFilesParams, deleteFileParams, exportWorkspaceParams } from './virtualFileSystemSchemas.js';

/**
 * Default S3 configuration from environment
 */
function getDefaultS3Config(): S3ClientConfig {
    return {
        endpoint: process.env['FS_ENDPOINT'] || 'http://localhost:9000',
        region: process.env['FS_REGION'] || 'us-east-1',
        accessKeyId: process.env['FS_ACCESS_ID'] || '',
        secretAccessKey: process.env['FS_ACCESS_KEY'] || '',
        bucket: process.env['FS_BUCKET'] || 'agentfs',
        forcePathStyle: true,
    };
}

export class VirtualFileSystemComponent extends ToolComponent {
    override toolSet: Map<string, Tool>;
    override handleToolCall: (toolName: string, params: any) => Promise<void>;

    private s3Client: S3Client;
    private defaultBucket: string;
    private currentPath: string = '';

    constructor() {
        super();
        const config = getDefaultS3Config();
        this.s3Client = createS3Client(config);
        this.defaultBucket = config.bucket || 'agentfs';
        this.toolSet = this.initializeToolSet();
        this.handleToolCall = this.handleToolCallImpl.bind(this);
    }

    private initializeToolSet(): Map<string, Tool> {
        const tools = new Map<string, Tool>();

        // read_file tool
        tools.set('read_file', {
            toolName: 'read_file',
            desc: 'Read content from a file in the virtual file system',
            paramsSchema: readFileParams,
        });

        // write_file tool
        tools.set('write_file', {
            toolName: 'write_file',
            desc: 'Write content to a file in the virtual file system',
            paramsSchema: writeFileParams,
        });

        // list_files tool
        tools.set('list_files', {
            toolName: 'list_files',
            desc: 'List files in a directory',
            paramsSchema: listFilesParams,
        });

        // delete_file tool
        tools.set('delete_file', {
            toolName: 'delete_file',
            desc: 'Delete a file from the virtual file system',
            paramsSchema: deleteFileParams,
        });

        // export_workspace tool
        tools.set('export_workspace', {
            toolName: 'export_workspace',
            desc: 'Export workspace state to a file in the virtual file system',
            paramsSchema: exportWorkspaceParams,
        });

        return tools;
    }

    private async handleToolCallImpl(toolName: string, params: any): Promise<void> {
        switch (toolName) {
            case 'read_file':
                await this.readFile(params.path);
                break;
            case 'write_file':
                await this.writeFile(params.path, params.content, params.contentType);
                break;
            case 'list_files':
                await this.listFiles(params.path);
                break;
            case 'delete_file':
                await this.deleteFile(params.path);
                break;
            case 'export_workspace':
                await this.exportWorkspace(params.bucket, params.path, params.content, params.contentType);
                break;
            default:
                console.warn(`Unknown tool: ${toolName}`);
        }
    }

    /**
     * Read file from S3
     */
    private async readFile(path: string): Promise<void> {
        const result = await downloadFile(this.s3Client, this.defaultBucket, path);

        if (result.success) {
            this.currentResults = {
                operation: 'read',
                path,
                content: result.content,
                message: `Successfully read file: ${path}`,
            };
        } else {
            this.currentResults = {
                operation: 'read',
                path,
                error: result.error,
                message: `Failed to read file: ${path}`,
            };
        }
    }

    /**
     * Write file to S3
     */
    private async writeFile(path: string, content: string, contentType?: string): Promise<void> {
        const result = await uploadFile(
            this.s3Client,
            this.defaultBucket,
            path,
            content,
            contentType
        );

        if (result.success) {
            this.currentResults = {
                operation: 'write',
                path,
                message: `Successfully wrote file: ${path}`,
            };
        } else {
            this.currentResults = {
                operation: 'write',
                path,
                error: result.error,
                message: `Failed to write file: ${path}`,
            };
        }
    }

    /**
     * List files in S3
     */
    private async listFiles(path?: string): Promise<void> {
        const prefix = path || this.currentPath;
        const result = await listFiles(this.s3Client, this.defaultBucket, prefix);

        if (result.success) {
            this.currentResults = {
                operation: 'list',
                path: prefix,
                files: result.files?.map(f => ({
                    name: f.key,
                    size: f.size,
                })) || [],
                message: `Found ${result.files?.length || 0} files in ${prefix}`,
            };
        } else {
            this.currentResults = {
                operation: 'list',
                path: prefix,
                error: result.error,
                message: `Failed to list files: ${prefix}`,
            };
        }
    }

    /**
     * Delete file from S3
     */
    private async deleteFile(path: string): Promise<void> {
        const result = await deleteFile(this.s3Client, this.defaultBucket, path);

        if (result.success) {
            this.currentResults = {
                operation: 'delete',
                path,
                message: `Successfully deleted file: ${path}`,
            };
        } else {
            this.currentResults = {
                operation: 'delete',
                path,
                error: result.error,
                message: `Failed to delete file: ${path}`,
            };
        }
    }

    /**
     * Export workspace to S3
     * The content should be provided by the caller (LLM or auto-export handler)
     */
    private async exportWorkspace(
        bucket: string,
        path: string,
        content: string,
        contentType?: string
    ): Promise<void> {
        // Determine content type based on file extension if not provided
        let finalContentType = contentType;
        if (!finalContentType) {
            if (path.endsWith('.json')) {
                finalContentType = 'application/json';
            } else if (path.endsWith('.md')) {
                finalContentType = 'text/markdown';
            } else if (path.endsWith('.txt')) {
                finalContentType = 'text/plain';
            } else {
                finalContentType = 'application/octet-stream';
            }
        }

        const targetBucket = bucket || this.defaultBucket;
        const result = await uploadFile(
            this.s3Client,
            targetBucket,
            path,
            content,
            finalContentType
        );

        if (result.success) {
            this.currentResults = {
                operation: 'export',
                bucket: targetBucket,
                path,
                success: true,
                message: `Successfully exported to ${targetBucket}/${path}`,
            };
        } else {
            this.currentResults = {
                operation: 'export',
                bucket: targetBucket,
                path,
                success: false,
                error: result.error,
                message: `Failed to export: ${result.error}`,
            };
        }
    }

    /**
     * Public method for auto-export (called by ExpertInstance)
     * This bypasses the tool call mechanism and directly uploads content
     */
    async exportContent(
        bucket: string,
        path: string,
        content: string,
        contentType?: string
    ): Promise<{ success: boolean; error?: string }> {
        const targetBucket = bucket || this.defaultBucket;
        const result = await uploadFile(
            this.s3Client,
            targetBucket,
            path,
            content,
            contentType
        );

        return {
            success: result.success,
            error: result.error,
        };
    }

    /**
     * Component state for results
     */
    private currentResults: any = null;

    /**
     * Render component UI for LLM
     */
    override renderImply = async (): Promise<TUIElement[]> => {
        const elements: TUIElement[] = [];

        // Header
        elements.push(
            new th({
                content: 'Virtual File System',
                styles: { align: 'center' },
            })
        );

        // Connection status
        const bucketStatus = await bucketExists(this.s3Client, this.defaultBucket);
        elements.push(
            new tdiv({
                content: `Bucket: ${this.defaultBucket} ${bucketStatus ? '(Connected)' : '(Not Found)'}`,
                styles: { showBorder: true },
            })
        );

        // Current operation results
        if (this.currentResults) {
            const resultDiv = new tdiv({ styles: { showBorder: true } });
            resultDiv.addChild(
                new tp({
                    content: `Last Operation: ${this.currentResults.operation}`,
                })
            );
            resultDiv.addChild(
                new tp({
                    content: this.currentResults.message || '',
                })
            );
            elements.push(resultDiv);
        } else {
            elements.push(
                new tdiv({
                    content: 'Ready. Use tools to interact with file system.',
                })
            );
        }

        return elements;
    };

    /**
     * Get component state for export
     */
    override getState(): any {
        return {
            bucket: this.defaultBucket,
            currentPath: this.currentPath,
            lastOperation: this.currentResults?.operation,
        };
    }
}
