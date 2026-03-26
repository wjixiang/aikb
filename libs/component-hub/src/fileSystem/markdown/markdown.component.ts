import {
  ToolComponent,
  ExportOptions,
  ComponentStateBase,
} from 'agent-lib/components';
import {
  Tool,
  ToolCallResult,
  TUIElement,
  tdiv,
  th,
  tp,
  tbr,
} from 'agent-lib/components/ui';
import { ApiClient, type ApiClientConfig } from '../apiClient.js';
import {
  markdownToolSchemas,
  type MarkdownToolName,
  type CreateFileParams,
  type UpdateFileParams,
  type DeleteFileParams,
  type CopyFileParams,
  type FileExistsParams,
  type GetFileMetadataParams,
  type ReadMarkdownByPageParams,
  type EditMarkdownReplaceParams,
  type EditMarkdownInsertParams,
  type EditMarkdownDeleteParams,
} from './markdownSchemas.js';
import type {
  FileCreateResponse,
  FileUpdateResponse,
  FileDeleteResponse,
  FileCopyResponse,
  FileExistsResponse,
  FileMetadataResponse,
  MarkdownPageResponse,
  MarkdownEditResponse,
} from './markdown.types.js';

export type { MarkdownToolName } from './markdownSchemas.js';
export type {
  CreateFileParams,
  UpdateFileParams,
  DeleteFileParams,
  CopyFileParams,
  FileExistsParams,
  GetFileMetadataParams,
  ReadMarkdownByPageParams,
  EditMarkdownReplaceParams,
  EditMarkdownInsertParams,
  EditMarkdownDeleteParams,
} from './markdownSchemas.js';

export interface MarkdownComponentConfig extends ApiClientConfig {
  defaultPrefix?: string;
  defaultContentType?: string;
}

export interface MarkdownComponentState {
  currentMdContent?: string;
  currentS3Key?: string;
  currentPage?: number;
  totalPages?: number;
  startLine?: number;
  endLine?: number;
  hasNext?: boolean;
  hasPrevious?: boolean;
  activeFile?: string;
  recentOperations: Array<{
    operation: string;
    s3Key: string;
    timestamp: number;
    success: boolean;
  }>;
}

export interface MarkdownHooks {
  exists(s3Key: string): Promise<boolean>;
  write(
    s3Key: string,
    content: string,
    contentType?: string,
  ): Promise<FileCreateResponse>;
  delete(s3Key: string): Promise<FileDeleteResponse>;
  createPath(fileName: string, type?: string): string;
}

export class MarkdownComponent extends ToolComponent {
  override componentId = 'markdown';
  override displayName = 'Markdown';
  override description = 'Markdown file management with editing capabilities';
  override componentPrompt = `## Markdown File Management

This component provides comprehensive markdown file editing and management capabilities.

**File Operations:**
- Create, read, update, and delete markdown files
- Edit files using replace, insert, or delete operations
- Check file existence and read metadata
- Support for paginated content reading

**Best Practices:**
- Use readByPage for large documents to manage context
- Use editReplace for targeted content modifications
- Use editInsert to add new content at specific locations
- Keep backups before major edits`;

  toolSet: Map<string, Tool>;
  private config: {
    baseUrl: string;
    apiKey: string | undefined;
    timeout: number;
    defaultPrefix: string;
    defaultContentType: string;
  };
  private apiClient: ApiClient;

  private componentState: MarkdownComponentState = {
    currentMdContent: '',
    recentOperations: [],
  };

  constructor(config: MarkdownComponentConfig) {
    super();
    this.config = {
      timeout: 30000,
      defaultContentType: 'text/markdown',
      defaultPrefix: 'markdown/',
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
    };
    this.apiClient = new ApiClient({
      baseUrl: this.config.baseUrl,
      apiKey: this.config.apiKey,
      timeout: this.config.timeout,
    });
    this.toolSet = this.initializeToolSet();
  }

  private _setState(state: Partial<MarkdownComponentState>): void {
    this.componentState = { ...this.componentState, ...state };
  }

  private _getState(): MarkdownComponentState {
    return { ...this.componentState };
  }

  override exportState(): MarkdownComponentState & ComponentStateBase {
    return {
      ...this._state,
      ...this.componentState,
    };
  }

  override restoreState(
    state: MarkdownComponentState & ComponentStateBase,
  ): void {
    this._state = {
      version: state.version,
      updatedAt: state.updatedAt,
    };
    this.componentState = {
      currentMdContent: state.currentMdContent,
      currentS3Key: state.currentS3Key,
      currentPage: state.currentPage,
      totalPages: state.totalPages,
      startLine: state.startLine,
      endLine: state.endLine,
      hasNext: state.hasNext,
      hasPrevious: state.hasPrevious,
      activeFile: state.activeFile,
      recentOperations: state.recentOperations || [],
    };
  }

  private initializeToolSet(): Map<string, Tool> {
    const tools = new Map<string, Tool>();

    const toolEntries: [
      string,
      (typeof markdownToolSchemas)[keyof typeof markdownToolSchemas],
    ][] = [
      ['createFile', markdownToolSchemas.createFile],
      ['updateFile', markdownToolSchemas.updateFile],
      ['deleteFile', markdownToolSchemas.deleteFile],
      ['copyFile', markdownToolSchemas.copyFile],
      ['fileExists', markdownToolSchemas.fileExists],
      ['getFileMetadata', markdownToolSchemas.getFileMetadata],
      ['readMarkdownByPage', markdownToolSchemas.readMarkdownByPage],
      ['editMarkdownReplace', markdownToolSchemas.editMarkdownReplace],
      ['editMarkdownInsert', markdownToolSchemas.editMarkdownInsert],
      ['editMarkdownDelete', markdownToolSchemas.editMarkdownDelete],
    ];

    toolEntries.forEach(([name, tool]) => {
      tools.set(name, tool);
    });

    return tools;
  }

  handleToolCall: {
    <T extends MarkdownToolName>(
      toolName: T,
      params: unknown,
    ): Promise<ToolCallResult<any>>;
    (toolName: string, params: unknown): Promise<ToolCallResult<any>>;
  } = async (
    toolName: string,
    params: unknown,
  ): Promise<ToolCallResult<any>> => {
    try {
      switch (toolName) {
        case 'createFile':
          return await this.handleCreateFile(params as CreateFileParams);
        case 'updateFile':
          return await this.handleUpdateFile(params as UpdateFileParams);
        case 'deleteFile':
          return await this.handleDeleteFile(params as DeleteFileParams);
        case 'copyFile':
          return await this.handleCopyFile(params as CopyFileParams);
        case 'fileExists':
          return await this.handleFileExists(params as FileExistsParams);
        case 'getFileMetadata':
          return await this.handleGetFileMetadata(
            params as GetFileMetadataParams,
          );
        case 'readMarkdownByPage':
          return await this.handleReadMarkdownByPage(
            params as ReadMarkdownByPageParams,
          );
        case 'editMarkdownReplace':
          return await this.handleEditMarkdownReplace(
            params as EditMarkdownReplaceParams,
          );
        case 'editMarkdownInsert':
          return await this.handleEditMarkdownInsert(
            params as EditMarkdownInsertParams,
          );
        case 'editMarkdownDelete':
          return await this.handleEditMarkdownDelete(
            params as EditMarkdownDeleteParams,
          );
        default:
          return {
            success: false,
            data: { error: `Unknown tool: ${toolName}` },
            summary: `[Markdown] Unknown tool: ${toolName}`,
          };
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        success: false,
        data: { error: errorMessage },
        summary: `[Markdown] Error: ${errorMessage}`,
      };
    }
  };

  private async handleCreateFile(
    params: CreateFileParams,
  ): Promise<ToolCallResult<FileCreateResponse>> {
    const result = await this.createFile(params);
    this._addOperation('createFile', params.s3Key, result.success);
    return {
      success: result.success,
      data: result,
      summary: result.success
        ? `[Markdown] Created ${params.s3Key} (${result.file_size} bytes)`
        : `[Markdown] Failed to create: ${result.message}`,
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
        ? `[Markdown] Updated ${params.s3Key} (${result.file_size} bytes)`
        : `[Markdown] Failed to update: ${result.message}`,
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
        ? `[Markdown] Deleted ${params.s3Key}`
        : `[Markdown] Failed to delete: ${result.message}`,
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
        ? `[Markdown] Copied ${params.s3Key} -> ${result.new_s3_key}`
        : `[Markdown] Failed to copy: ${result.message}`,
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
        ? `[Markdown] ${params.s3Key} exists`
        : `[Markdown] ${params.s3Key} does not exist`,
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
        ? `[Markdown] ${params.s3Key} (${result.file_size} bytes)`
        : `[Markdown] Failed to get metadata: ${params.s3Key}`,
    };
  }

  private async handleReadMarkdownByPage(
    params: ReadMarkdownByPageParams,
  ): Promise<ToolCallResult<MarkdownPageResponse>> {
    const result = await this.readMarkdownByPage(params);
    this._setState({
      currentMdContent: result.content,
      currentS3Key: params.s3Key,
      currentPage: result.page,
      totalPages: result.metadata.total_pages,
      startLine: result.start_line,
      endLine: result.end_line,
      hasNext: result.has_next,
      hasPrevious: result.has_previous,
      activeFile: params.s3Key,
    });
    return {
      success: true,
      data: result,
      summary: `[Markdown] Read ${params.s3Key} page ${result.page}/${result.metadata.total_pages} (${result.content.length} chars)`,
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
        ? `[Markdown] Replaced lines ${params.startLine}-${params.endLine} in ${params.s3Key}`
        : `[Markdown] Failed to edit: ${result.message}`,
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
        ? `[Markdown] Inserted at ${params.position} in ${params.s3Key}`
        : `[Markdown] Failed to insert: ${result.message}`,
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
        ? `[Markdown] Deleted lines ${params.startLine}-${params.endLine} in ${params.s3Key}`
        : `[Markdown] Failed to delete lines: ${result.message}`,
    };
  }

  private _addOperation(
    operation: string,
    s3Key: string,
    success: boolean,
  ): void {
    this.componentState.recentOperations.push({
      operation,
      s3Key,
      timestamp: Date.now(),
      success,
    });
    if (this.componentState.recentOperations.length > 10) {
      this.componentState.recentOperations =
        this.componentState.recentOperations.slice(-10);
    }
  }

  private async createFile(
    params: CreateFileParams,
  ): Promise<FileCreateResponse> {
    return this.apiClient.request<FileCreateResponse>('/editor/create', {
      method: 'POST',
      body: JSON.stringify({
        s3_key: params.s3Key,
        content: params.content,
        content_type: params.contentType,
      }),
    });
  }

  private async updateFile(
    params: UpdateFileParams,
  ): Promise<FileUpdateResponse> {
    return this.apiClient.request<FileUpdateResponse>('/editor/update', {
      method: 'POST',
      body: JSON.stringify({
        s3_key: params.s3Key,
        content: params.content,
        mode: params.mode,
      }),
    });
  }

  private async deleteFile(
    params: DeleteFileParams,
  ): Promise<FileDeleteResponse> {
    return this.apiClient.request<FileDeleteResponse>('/editor/delete', {
      method: 'POST',
      body: JSON.stringify({ s3_key: params.s3Key }),
    });
  }

  private async copyFile(params: CopyFileParams): Promise<FileCopyResponse> {
    return this.apiClient.request<FileCopyResponse>('/editor/copy', {
      method: 'POST',
      body: JSON.stringify({
        s3_key: params.s3Key,
        new_s3_key: params.newS3Key,
      }),
    });
  }

  private async fileExists(
    params: FileExistsParams,
  ): Promise<FileExistsResponse> {
    return this.apiClient.request<FileExistsResponse>('/editor/exists', {
      method: 'POST',
      body: JSON.stringify({ s3_key: params.s3Key }),
    });
  }

  private async getFileMetadata(
    params: GetFileMetadataParams,
  ): Promise<FileMetadataResponse> {
    return {
      success: false,
      s3_key: params.s3Key,
      content_type: 'unknown',
      file_size: 0,
    };
  }

  private async readMarkdownByPage(
    params: ReadMarkdownByPageParams,
  ): Promise<MarkdownPageResponse> {
    return this.apiClient.request<MarkdownPageResponse>(
      '/markdown/read/bypage',
      {
        method: 'POST',
        body: JSON.stringify({
          s3_key: params.s3Key,
          page: params.page,
          page_size: params.pageSize,
        }),
      },
    );
  }

  private async editMarkdownReplace(
    params: EditMarkdownReplaceParams,
  ): Promise<MarkdownEditResponse> {
    return this.apiClient.request<MarkdownEditResponse>(
      '/markdown/edit/replace',
      {
        method: 'POST',
        body: JSON.stringify({
          s3_key: params.s3Key,
          start_line: params.startLine,
          end_line: params.endLine,
          new_content: params.newContent,
        }),
      },
    );
  }

  private async editMarkdownInsert(
    params: EditMarkdownInsertParams,
  ): Promise<MarkdownEditResponse> {
    return this.apiClient.request<MarkdownEditResponse>(
      '/markdown/edit/insert',
      {
        method: 'POST',
        body: JSON.stringify({
          s3_key: params.s3Key,
          content: params.content,
          position: params.position,
          target_line: params.targetLine,
        }),
      },
    );
  }

  private async editMarkdownDelete(
    params: EditMarkdownDeleteParams,
  ): Promise<MarkdownEditResponse> {
    return this.apiClient.request<MarkdownEditResponse>(
      '/markdown/edit/delete',
      {
        method: 'POST',
        body: JSON.stringify({
          s3_key: params.s3Key,
          start_line: params.startLine,
          end_line: params.endLine,
        }),
      },
    );
  }

  getHooks(): MarkdownHooks {
    return {
      exists: async (s3Key: string) => {
        const result = await this.fileExists({ s3Key });
        return result.exists;
      },
      write: async (s3Key: string, content: string, contentType?: string) => {
        return this.createFile({
          s3Key,
          content,
          contentType:
            contentType || this.config.defaultContentType || 'text/markdown',
        });
      },
      delete: async (s3Key: string) => {
        return this.deleteFile({ s3Key });
      },
      createPath: (fileName: string, type = 'markdown') => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const uuid = crypto.randomUUID();
        const sanitized = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
        return `${this.config.defaultPrefix || 'markdown/'}${type}/${year}/${month}/${day}/${uuid}/${sanitized}`;
      },
    };
  }

  renderImply = async (): Promise<TUIElement[]> => {
    const elements: TUIElement[] = [];

    elements.push(
      new th({
        content: 'Markdown Editor',
        styles: { align: 'center' },
      }),
    );

    const infoTexts: string[] = [`Server: ${this.config.baseUrl}`];
    if (this.config.defaultPrefix) {
      infoTexts.push(`Prefix: ${this.config.defaultPrefix}`);
    }

    elements.push(
      new tdiv({
        content: infoTexts.join(' | '),
        styles: {
          align: 'center',
          padding: { vertical: 1 },
        },
      }),
    );

    const mdContainer = new tdiv({ styles: { showBorder: true } });

    if (this.componentState.currentMdContent) {
      if (this.componentState.currentS3Key) {
        mdContainer.addChild(
          new tp({
            content: `📄 ${this.componentState.currentS3Key}`,
            indent: 1,
          }),
        );
      }

      if (this.componentState.currentPage && this.componentState.totalPages) {
        const pageIndicator = `Page ${this.componentState.currentPage}/${this.componentState.totalPages}`;
        const lineInfo =
          this.componentState.startLine !== undefined &&
          this.componentState.endLine !== undefined
            ? ` (Lines ${this.componentState.startLine + 1}-${this.componentState.endLine + 1})`
            : '';

        mdContainer.addChild(
          new tp({
            content: `${pageIndicator}${lineInfo}`,
            indent: 1,
          }),
        );
        mdContainer.addChild(new tbr());
      }

      mdContainer.addChild(
        new tdiv({
          content: this.componentState.currentMdContent,
        }),
      );

      if (this.componentState.hasNext || this.componentState.hasPrevious) {
        mdContainer.addChild(new tbr());
        const navHints: string[] = [];
        if (this.componentState.hasPrevious) {
          navHints.push('◀ Previous');
        }
        if (this.componentState.hasNext) {
          navHints.push('Next ▶');
        }
        mdContainer.addChild(
          new tp({
            content: navHints.join('  |  '),
            indent: 1,
            styles: { align: 'center' },
          }),
        );
      }
    } else {
      mdContainer.addChild(
        new tp({
          content: '(No File Content)',
          indent: 1,
        }),
      );
    }

    elements.push(mdContainer);

    if (this.componentState.recentOperations.length > 0) {
      elements.push(new tp({ content: '', indent: 1 }));
      elements.push(new tbr());
      elements.push(
        new tp({
          content: 'Recent Operations:',
          indent: 1,
        }),
      );
      for (const op of this.componentState.recentOperations
        .slice(-5)
        .reverse()) {
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

export function createMarkdownComponent(
  config: MarkdownComponentConfig,
): MarkdownComponent {
  return new MarkdownComponent(config);
}
