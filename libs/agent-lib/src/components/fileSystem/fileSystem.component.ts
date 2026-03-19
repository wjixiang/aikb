/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { ToolComponent, ExportOptions } from '../core/toolComponent.js';
import {
  Tool,
  ToolCallResult,
  TUIElement,
  tdiv,
  th,
  tp,
} from '../ui/index.js';
import {
  FileSystemComponentConfig,
  fileSystemToolSchemas,
  type FileSystemToolName,
  type ToolReturnType,
  type ListFilesParams,
  type ReadFileParams,
  type CreateFileParams,
  type UpdateFileParams,
  type DeleteFileParams,
  type MoveFileParams,
  type CopyFileParams,
  type FileExistsParams,
  type GetFileMetadataParams,
  type ReadMarkdownByPageParams,
  type EditMarkdownReplaceParams,
  type EditMarkdownInsertParams,
  type EditMarkdownDeleteParams,
  type ConvertToMarkdownParams,
  type ConvertToTextParams,
} from './fileSystemSchemas.js';
import type {
  FileListItem,
  FileListResponse,
  FileReadResponse,
  FileCreateResponse,
  FileUpdateResponse,
  FileDeleteResponse,
  FileMoveResponse,
  FileCopyResponse,
  FileExistsResponse,
  FileMetadataResponse,
  MarkdownPageResponse,
  MarkdownEditResponse,
  ConversionResponse,
} from './fileSystem.types.js';

/**
 * FileSystemComponent Configuration
 */
export type { FileSystemComponentConfig } from './fileSystemSchemas.js';

/**
 * FileSystem Component State
 */
export interface FileSystemComponentState {
  /** Currently listed files */
  files: FileListItem[];
  /** Total file count */
  totalFiles: number;
  /** Currently selected/active file s3Key */
  activeFile?: string;
  /** Recent operations log */
  recentOperations: Array<{
    operation: string;
    s3Key: string;
    timestamp: number;
    success: boolean;
  }>;
}

/**
 * Hook API exposed to other components
 */
export interface FileSystemHooks {
  /** Quick check if file exists */
  exists(s3Key: string): Promise<boolean>;
  /** Read file content */
  read(s3Key: string): Promise<string>;
  /** Write file content (creates or overwrites) */
  write(s3Key: string, content: string, contentType?: string): Promise<FileCreateResponse>;
  /** List files with prefix */
  list(prefix?: string, limit?: number): Promise<FileListItem[]>;
  /** Delete file */
  delete(s3Key: string): Promise<FileDeleteResponse>;
  /** Get s3Key for a newly created file following standard path pattern */
  createPath(fileName: string, type?: string): string;
}

/**
 * FileSystemComponent - Cloud file storage component for agent file management
 *
 * Provides tools for:
 * - File CRUD operations (list, read, create, update, delete)
 * - File operations (move, copy, exists, metadata)
 * - Markdown editing (read by page, replace, insert, delete lines)
 * - File conversion (to Markdown, to Text via Docling)
 *
 * Integrates with MailComponent for cross-agent file sharing via s3Key.
 *
 * @example
 * ```typescript
 * const fs = new FileSystemComponent({
 *   baseUrl: 'http://localhost:8000',
 *   defaultPrefix: 'agent-files/',
 * });
 *
 * // List files
 * await fs.handleToolCall('listFiles', { prefix: 'notes/', limit: 10 });
 *
 * // Read a file
 * await fs.handleToolCall('readFile', { s3Key: 'notes/todo.md' });
 *
 * // Create a file
 * await fs.handleToolCall('createFile', {
 *   s3Key: 'notes/new.md',
 *   content: '# My Notes',
 *   contentType: 'text/markdown',
 * });
 *
 * // Get hook API for other components
 * const hooks = fs.getHooks();
 * const content = await hooks.read('shared-docs/report.md');
 * ```
 */
export class FileSystemComponent extends ToolComponent {
  override componentId = 'fileSystem';
  override displayName = 'FileSystem';
  override description = 'Cloud file storage system for agent file management with S3 backend';

  toolSet: Map<string, Tool>;
  private config: FileSystemComponentConfig;

  // Property-based state
  private state: FileSystemComponentState = {
    files: [],
    totalFiles: 0,
    recentOperations: [],
  };

  constructor(config: FileSystemComponentConfig) {
    super();
    this.config = {
      timeout: 30000,
      defaultContentType: 'text/plain',
      defaultPrefix: 'agent-files/',
      ...config,
    };
    this.toolSet = this.initializeToolSet();
  }

  // ==================== State Management ====================

  private _setState(state: Partial<FileSystemComponentState>): void {
    this.state = { ...this.state, ...state };
  }

  private _getState(): FileSystemComponentState {
    return { ...this.state };
  }

  // ==================== Tool Definitions ====================

  private initializeToolSet(): Map<string, Tool> {
    const tools = new Map<string, Tool>();

    const toolEntries: [string, (typeof fileSystemToolSchemas)[keyof typeof fileSystemToolSchemas]][] = [
      ['listFiles', fileSystemToolSchemas.listFiles],
      ['readFile', fileSystemToolSchemas.readFile],
      ['createFile', fileSystemToolSchemas.createFile],
      ['updateFile', fileSystemToolSchemas.updateFile],
      ['deleteFile', fileSystemToolSchemas.deleteFile],
      ['moveFile', fileSystemToolSchemas.moveFile],
      ['copyFile', fileSystemToolSchemas.copyFile],
      ['fileExists', fileSystemToolSchemas.fileExists],
      ['getFileMetadata', fileSystemToolSchemas.getFileMetadata],
      ['readMarkdownByPage', fileSystemToolSchemas.readMarkdownByPage],
      ['editMarkdownReplace', fileSystemToolSchemas.editMarkdownReplace],
      ['editMarkdownInsert', fileSystemToolSchemas.editMarkdownInsert],
      ['editMarkdownDelete', fileSystemToolSchemas.editMarkdownDelete],
      ['convertToMarkdown', fileSystemToolSchemas.convertToMarkdown],
      ['convertToText', fileSystemToolSchemas.convertToText],
    ];

    toolEntries.forEach(([name, tool]) => {
      tools.set(name, tool);
    });

    return tools;
  }

  // ==================== Tool Call Handler ====================

  handleToolCall: {
    <T extends FileSystemToolName>(toolName: T, params: unknown): Promise<ToolCallResult<ToolReturnType<T>>>;
    (toolName: string, params: unknown): Promise<ToolCallResult<any>>;
  } = async (
    toolName: string,
    params: unknown,
  ): Promise<ToolCallResult<any>> => {
    try {
      switch (toolName) {
        case 'listFiles':
          return await this.handleListFiles(params as ListFilesParams);
        case 'readFile':
          return await this.handleReadFile(params as ReadFileParams);
        case 'createFile':
          return await this.handleCreateFile(params as CreateFileParams);
        case 'updateFile':
          return await this.handleUpdateFile(params as UpdateFileParams);
        case 'deleteFile':
          return await this.handleDeleteFile(params as DeleteFileParams);
        case 'moveFile':
          return await this.handleMoveFile(params as MoveFileParams);
        case 'copyFile':
          return await this.handleCopyFile(params as CopyFileParams);
        case 'fileExists':
          return await this.handleFileExists(params as FileExistsParams);
        case 'getFileMetadata':
          return await this.handleGetFileMetadata(params as GetFileMetadataParams);
        case 'readMarkdownByPage':
          return await this.handleReadMarkdownByPage(params as ReadMarkdownByPageParams);
        case 'editMarkdownReplace':
          return await this.handleEditMarkdownReplace(params as EditMarkdownReplaceParams);
        case 'editMarkdownInsert':
          return await this.handleEditMarkdownInsert(params as EditMarkdownInsertParams);
        case 'editMarkdownDelete':
          return await this.handleEditMarkdownDelete(params as EditMarkdownDeleteParams);
        case 'convertToMarkdown':
          return await this.handleConvertToMarkdown(params as ConvertToMarkdownParams);
        case 'convertToText':
          return await this.handleConvertToText(params as ConvertToTextParams);
        default:
          return {
            success: false,
            data: { error: `Unknown tool: ${toolName}` },
            summary: `[FileSystem] Unknown tool: ${toolName}`,
          };
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        success: false,
        data: { error: errorMessage },
        summary: `[FileSystem] Error: ${errorMessage}`,
      };
    }
  };

  // ==================== Individual Tool Handlers ====================

  private async handleListFiles(
    params: ListFilesParams,
  ): Promise<ToolCallResult<FileListResponse>> {
    const result = await this.listFiles(params);
    this._setState({ files: result.files, totalFiles: result.total });
    this._addOperation('listFiles', params.prefix || '/', result.success);
    return {
      success: result.success,
      data: result,
      summary: `[FileSystem] Listed ${result.files.length}/${result.total} files`,
    };
  }

  private async handleReadFile(
    params: ReadFileParams,
  ): Promise<ToolCallResult<FileReadResponse>> {
    const result = await this.readFile(params);
    this._setState({ activeFile: params.s3Key });
    this._addOperation('readFile', params.s3Key, result.success);
    return {
      success: result.success,
      data: result,
      summary: result.success
        ? `[FileSystem] Read ${params.s3Key} (${result.file_size} bytes)`
        : `[FileSystem] Failed to read: ${params.s3Key}`,
    };
  }

  private async handleCreateFile(
    params: CreateFileParams,
  ): Promise<ToolCallResult<FileCreateResponse>> {
    const result = await this.createFile(params);
    this._addOperation('createFile', params.s3Key, result.success);
    return {
      success: result.success,
      data: result,
      summary: result.success
        ? `[FileSystem] Created ${params.s3Key} (${result.file_size} bytes)`
        : `[FileSystem] Failed to create: ${result.message}`,
    };
  }

  private async handleUpdateFile(
    params: UpdateFileParams,
  ): Promise<ToolCallResult<FileUpdateResponse>> {
    const result = await this.updateFile(params);
    this._addOperation('updateFile', params.s3Key, result.success);
    return {
      success: result.success,
      data: result,
      summary: result.success
        ? `[FileSystem] Updated ${params.s3Key} (${result.file_size} bytes)`
        : `[FileSystem] Failed to update: ${result.message}`,
    };
  }

  private async handleDeleteFile(
    params: DeleteFileParams,
  ): Promise<ToolCallResult<FileDeleteResponse>> {
    const result = await this.deleteFile(params);
    this._addOperation('deleteFile', params.s3Key, result.success);
    return {
      success: result.success,
      data: result,
      summary: result.success
        ? `[FileSystem] Deleted ${params.s3Key}`
        : `[FileSystem] Failed to delete: ${result.message}`,
    };
  }

  private async handleMoveFile(
    params: MoveFileParams,
  ): Promise<ToolCallResult<FileMoveResponse>> {
    const result = await this.moveFile(params);
    this._addOperation('moveFile', params.s3Key, result.success);
    return {
      success: result.success,
      data: result,
      summary: result.success
        ? `[FileSystem] Moved ${params.s3Key} -> ${result.new_s3_key}`
        : `[FileSystem] Failed to move: ${result.message}`,
    };
  }

  private async handleCopyFile(
    params: CopyFileParams,
  ): Promise<ToolCallResult<FileCopyResponse>> {
    const result = await this.copyFile(params);
    this._addOperation('copyFile', params.s3Key, result.success);
    return {
      success: result.success,
      data: result,
      summary: result.success
        ? `[FileSystem] Copied ${params.s3Key} -> ${result.new_s3_key}`
        : `[FileSystem] Failed to copy: ${result.message}`,
    };
  }

  private async handleFileExists(
    params: FileExistsParams,
  ): Promise<ToolCallResult<FileExistsResponse>> {
    const result = await this.fileExists(params);
    return {
      success: true,
      data: result,
      summary: result.exists
        ? `[FileSystem] ${params.s3Key} exists`
        : `[FileSystem] ${params.s3Key} does not exist`,
    };
  }

  private async handleGetFileMetadata(
    params: GetFileMetadataParams,
  ): Promise<ToolCallResult<FileMetadataResponse>> {
    const result = await this.getFileMetadata(params);
    return {
      success: result.success,
      data: result,
      summary: result.success
        ? `[FileSystem] ${params.s3Key} (${result.file_size} bytes)`
        : `[FileSystem] Failed to get metadata: ${params.s3Key}`,
    };
  }

  private async handleReadMarkdownByPage(
    params: ReadMarkdownByPageParams,
  ): Promise<ToolCallResult<MarkdownPageResponse>> {
    const result = await this.readMarkdownByPage(params);
    return {
      success: true,
      data: result,
      summary: `[FileSystem] Read ${params.s3Key} page ${result.page} (${result.content.length} chars)`,
    };
  }

  private async handleEditMarkdownReplace(
    params: EditMarkdownReplaceParams,
  ): Promise<ToolCallResult<MarkdownEditResponse>> {
    const result = await this.editMarkdownReplace(params);
    this._addOperation('editMarkdownReplace', params.s3Key, result.success);
    return {
      success: result.success,
      data: result,
      summary: result.success
        ? `[FileSystem] Replaced lines ${params.startLine}-${params.endLine} in ${params.s3Key}`
        : `[FileSystem] Failed to edit: ${result.message}`,
    };
  }

  private async handleEditMarkdownInsert(
    params: EditMarkdownInsertParams,
  ): Promise<ToolCallResult<MarkdownEditResponse>> {
    const result = await this.editMarkdownInsert(params);
    this._addOperation('editMarkdownInsert', params.s3Key, result.success);
    return {
      success: result.success,
      data: result,
      summary: result.success
        ? `[FileSystem] Inserted at ${params.position} in ${params.s3Key}`
        : `[FileSystem] Failed to insert: ${result.message}`,
    };
  }

  private async handleEditMarkdownDelete(
    params: EditMarkdownDeleteParams,
  ): Promise<ToolCallResult<MarkdownEditResponse>> {
    const result = await this.editMarkdownDelete(params);
    this._addOperation('editMarkdownDelete', params.s3Key, result.success);
    return {
      success: result.success,
      data: result,
      summary: result.success
        ? `[FileSystem] Deleted lines ${params.startLine}-${params.endLine} in ${params.s3Key}`
        : `[FileSystem] Failed to delete lines: ${result.message}`,
    };
  }

  private async handleConvertToMarkdown(
    params: ConvertToMarkdownParams,
  ): Promise<ToolCallResult<ConversionResponse>> {
    const result = await this.convertToMarkdown(params);
    return {
      success: result.success,
      data: result,
      summary: result.success
        ? `[FileSystem] Converted ${params.s3Key} to Markdown`
        : `[FileSystem] Conversion failed: ${result.message}`,
    };
  }

  private async handleConvertToText(
    params: ConvertToTextParams,
  ): Promise<ToolCallResult<ConversionResponse>> {
    const result = await this.convertToText(params);
    return {
      success: result.success,
      data: result,
      summary: result.success
        ? `[FileSystem] Converted ${params.s3Key} to Text`
        : `[FileSystem] Conversion failed: ${result.message}`,
    };
  }

  // ==================== Internal Helpers ====================

  private _addOperation(operation: string, s3Key: string, success: boolean): void {
    this.state.recentOperations.push({
      operation,
      s3Key,
      timestamp: Date.now(),
      success,
    });
    // Keep only last 10 operations
    if (this.state.recentOperations.length > 10) {
      this.state.recentOperations = this.state.recentOperations.slice(-10);
    }
  }

  // ==================== API Methods ====================

  private async listFiles(params: ListFilesParams): Promise<FileListResponse> {
    const queryParams = new URLSearchParams();
    if (params.prefix) queryParams.set('prefix', params.prefix);
    if (params.filterType && params.filterType !== 'all') {
      queryParams.set('filter_type', params.filterType);
    }
    queryParams.set('limit', String(params.limit));
    queryParams.set('offset', String(params.offset));
    queryParams.set('include_metadata', String(params.includeMetadata));

    return this.request<FileListResponse>(
      `/editor/list?${queryParams.toString()}`,
      { method: 'GET' },
    );
  }

  private async readFile(params: ReadFileParams): Promise<FileReadResponse> {
    return this.request<FileReadResponse>('/editor/read', {
      method: 'POST',
      body: JSON.stringify({ s3_key: params.s3Key, encoding: params.encoding }),
    });
  }

  private async createFile(params: CreateFileParams): Promise<FileCreateResponse> {
    return this.request<FileCreateResponse>('/editor/create', {
      method: 'POST',
      body: JSON.stringify({
        s3_key: params.s3Key,
        content: params.content,
        content_type: params.contentType,
        encoding: params.encoding,
      }),
    });
  }

  private async updateFile(params: UpdateFileParams): Promise<FileUpdateResponse> {
    return this.request<FileUpdateResponse>('/editor/update', {
      method: 'POST',
      body: JSON.stringify({
        s3_key: params.s3Key,
        content: params.content,
        mode: params.mode,
        encoding: params.encoding,
      }),
    });
  }

  private async deleteFile(params: DeleteFileParams): Promise<FileDeleteResponse> {
    return this.request<FileDeleteResponse>('/editor/delete', {
      method: 'POST',
      body: JSON.stringify({ s3_key: params.s3Key }),
    });
  }

  private async moveFile(params: MoveFileParams): Promise<FileMoveResponse> {
    return this.request<FileMoveResponse>('/editor/move', {
      method: 'POST',
      body: JSON.stringify({
        s3_key: params.s3Key,
        new_s3_key: params.newS3Key,
      }),
    });
  }

  private async copyFile(params: CopyFileParams): Promise<FileCopyResponse> {
    return this.request<FileCopyResponse>('/editor/copy', {
      method: 'POST',
      body: JSON.stringify({
        s3_key: params.s3Key,
        new_s3_key: params.newS3Key,
      }),
    });
  }

  private async fileExists(params: FileExistsParams): Promise<FileExistsResponse> {
    return this.request<FileExistsResponse>('/editor/exists', {
      method: 'POST',
      body: JSON.stringify({ s3_key: params.s3Key }),
    });
  }

  private async getFileMetadata(params: GetFileMetadataParams): Promise<FileMetadataResponse> {
    // Use list with prefix filter to find the file, then get its metadata
    const listResult = await this.listFiles({
      prefix: params.s3Key,
      limit: 1,
      offset: 0,
      filterType: 'all',
      includeMetadata: true,
    });
    const file = listResult.files.find(f => f.s3_key === params.s3Key);
    if (file) {
      return {
        success: true,
        s3_key: file.s3_key,
        file_name: file.file_name,
        content_type: file.content_type,
        file_size: file.file_size,
        modified_at: file.modified_at,
      };
    }
    // Fallback: try to read the file directly
    const readResult = await this.readFile({ s3Key: params.s3Key, encoding: 'utf-8' });
    if (readResult.success) {
      return {
        success: true,
        s3_key: params.s3Key,
        file_name: params.s3Key.split('/').pop() || params.s3Key,
        content_type: readResult.content_type || 'text/plain',
        file_size: readResult.file_size,
      };
    }
    return {
      success: false,
      s3_key: params.s3Key,
      file_name: params.s3Key.split('/').pop() || params.s3Key,
      content_type: 'unknown',
      file_size: 0,
    };
  }

  private async readMarkdownByPage(params: ReadMarkdownByPageParams): Promise<MarkdownPageResponse> {
    return this.request<MarkdownPageResponse>('/markdown/read/bypage', {
      method: 'POST',
      body: JSON.stringify({
        s3_key: params.s3Key,
        page: params.page,
        page_size: params.pageSize,
      }),
    });
  }

  private async editMarkdownReplace(params: EditMarkdownReplaceParams): Promise<MarkdownEditResponse> {
    return this.request<MarkdownEditResponse>('/markdown/edit/replace', {
      method: 'POST',
      body: JSON.stringify({
        s3_key: params.s3Key,
        start_line: params.startLine,
        end_line: params.endLine,
        new_content: params.newContent,
      }),
    });
  }

  private async editMarkdownInsert(params: EditMarkdownInsertParams): Promise<MarkdownEditResponse> {
    return this.request<MarkdownEditResponse>('/markdown/edit/insert', {
      method: 'POST',
      body: JSON.stringify({
        s3_key: params.s3Key,
        content: params.content,
        position: params.position,
        target_line: params.targetLine,
      }),
    });
  }

  private async editMarkdownDelete(params: EditMarkdownDeleteParams): Promise<MarkdownEditResponse> {
    return this.request<MarkdownEditResponse>('/markdown/edit/delete', {
      method: 'POST',
      body: JSON.stringify({
        s3_key: params.s3Key,
        start_line: params.startLine,
        end_line: params.endLine,
      }),
    });
  }

  private async convertToMarkdown(params: ConvertToMarkdownParams): Promise<ConversionResponse> {
    return this.request<ConversionResponse>('/docling/convert', {
      method: 'POST',
      body: JSON.stringify({
        s3_key: params.s3Key,
        output_format: 'MARKDOWN',
        target_s3_key: params.targetS3Key,
        force_refresh: params.forceRefresh,
      }),
    });
  }

  private async convertToText(params: ConvertToTextParams): Promise<ConversionResponse> {
    return this.request<ConversionResponse>('/docling/convert', {
      method: 'POST',
      body: JSON.stringify({
        s3_key: params.s3Key,
        output_format: 'TEXT',
        target_s3_key: params.targetS3Key,
        force_refresh: params.forceRefresh,
      }),
    });
  }

  // ==================== HTTP Request Helper ====================

  private async request<T>(
    path: string,
    options: RequestInit = {},
  ): Promise<T> {
    const url = `${this.config.baseUrl}/api/v1${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.config.apiKey) {
      headers['X-API-Key'] = this.config.apiKey;
    }

    if (options.headers) {
      const customHeaders = options.headers as Record<string, string>;
      Object.entries(customHeaders).forEach(([key, value]) => {
        headers[key] = value;
      });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: response.statusText })) as { detail?: string };
        throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timeout after ${this.config.timeout}ms`);
      }
      throw error;
    }
  }

  // ==================== Hook API ====================

  /**
   * Get hook API for external component use
   * Usage: const fs = fileSystemComponent.getHooks(); await fs.exists('notes/test.md');
   */
  getHooks(): FileSystemHooks {
    return {
      exists: async (s3Key: string) => {
        const result = await this.fileExists({ s3Key });
        return result.exists;
      },
      read: async (s3Key: string) => {
        const result = await this.readFile({ s3Key, encoding: 'utf-8' });
        return result.content || '';
      },
      write: async (s3Key: string, content: string, contentType?: string) => {
        return this.createFile({
          s3Key,
          content,
          contentType: contentType || this.config.defaultContentType || 'text/plain',
          encoding: 'utf-8',
        });
      },
      list: async (prefix = '', limit = 20) => {
        const result = await this.listFiles({
          prefix,
          limit,
          offset: 0,
          filterType: 'all',
          includeMetadata: false,
        });
        return result.files;
      },
      delete: async (s3Key: string) => {
        return this.deleteFile({ s3Key });
      },
      createPath: (fileName: string, type = 'text') => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const uuid = crypto.randomUUID();
        const sanitized = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
        return `${this.config.defaultPrefix || 'agent-files/'}${type}/${year}/${month}/${day}/${uuid}/${sanitized}`;
      },
    };
  }

  // ==================== UI Rendering ====================

  renderImply = async (): Promise<TUIElement[]> => {
    const elements: TUIElement[] = [];

    // Header
    elements.push(
      new th({
        content: 'FileSystem Component',
        styles: { align: 'center' },
      }),
    );

    // Connection info
    const infoTexts: string[] = [`Server: ${this.config.baseUrl}`];
    if (this.config.defaultPrefix) {
      infoTexts.push(`Prefix: ${this.config.defaultPrefix}`);
    }
    infoTexts.push(`Files: ${this.state.totalFiles}`);

    elements.push(
      new tdiv({
        content: infoTexts.join(' | '),
        styles: {
          align: 'center',
          padding: { vertical: 1 },
        },
      }),
    );

    // File list view
    if (this.state.files.length > 0) {
      elements.push(this.renderFileList());
    }

    // Recent operations
    if (this.state.recentOperations.length > 0) {
      elements.push(new tp({ content: '', indent: 1 }));
      elements.push(new tp({ content: '─'.repeat(60), indent: 1 }));
      elements.push(
        new tp({
          content: 'Recent Operations:',
          indent: 1,
          textStyle: { bold: true },
        }),
      );
      for (const op of this.state.recentOperations.slice(-5).reverse()) {
        const status = op.success ? '[OK]' : '[FAIL]';
        const time = new Date(op.timestamp).toLocaleTimeString();
        elements.push(
          new tp({
            content: `  ${status} ${op.operation} ${op.s3Key} (${time})`,
            indent: 2,
          }),
        );
      }
    }

    return elements;
  };

  private renderFileList(): TUIElement {
    const container = new tdiv({
      styles: { showBorder: true, padding: { vertical: 1 } },
    });

    container.addChild(
      new tp({
        content: `Files (${this.state.files.length} of ${this.state.totalFiles}):`,
        indent: 1,
        textStyle: { bold: true },
      }),
    );

    for (const file of this.state.files.slice(0, 10)) {
      container.addChild(
        new tp({
          content: `  ${file.file_name}`,
          indent: 2,
        }),
      );
      container.addChild(
        new tp({
          content: `    Path: ${file.s3_key}`,
          indent: 2,
        }),
      );
      container.addChild(
        new tp({
          content: `    Size: ${file.file_size} bytes | Type: ${file.content_type}`,
          indent: 2,
        }),
      );
    }

    if (this.state.files.length > 10) {
      container.addChild(
        new tp({
          content: `  ... and ${this.state.files.length - 10} more files`,
          indent: 2,
          textStyle: { italic: true },
        }),
      );
    }

    return container;
  }

  async exportData(options?: ExportOptions) {
    return {
      data: this._getState(),
      format: options?.format ?? 'json',
      metadata: {
        componentId: this.componentId,
        exportedAt: new Date().toISOString(),
      },
    };
  }
}

/**
 * Factory function to create FileSystemComponent
 */
export function createFileSystemComponent(
  config: FileSystemComponentConfig,
): FileSystemComponent {
  return new FileSystemComponent(config);
}
