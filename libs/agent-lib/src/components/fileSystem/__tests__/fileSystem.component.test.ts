import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FileSystemComponent, createFileSystemComponent } from '../fileSystem.component.js';
import type {
  FileSystemComponentConfig,
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
} from '../fileSystem.types.js';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('FileSystemComponent', () => {
  let component: FileSystemComponent;
  const mockBaseUrl = 'http://localhost:8000';

  const mockConfig: FileSystemComponentConfig = {
    baseUrl: mockBaseUrl,
    defaultPrefix: 'test-files/',
    timeout: 5000,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    component = new FileSystemComponent(mockConfig);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==================== Constructor & Initialization ====================

  describe('Constructor', () => {
    it('should create component with default config', () => {
      const fs = new FileSystemComponent({ baseUrl: mockBaseUrl });
      expect(fs.componentId).toBe('fileSystem');
      expect(fs.displayName).toBe('FileSystem');
    });

    it('should create component with custom config', () => {
      const fs = createFileSystemComponent({
        baseUrl: 'http://custom:9000',
        defaultPrefix: 'custom-prefix/',
        apiKey: 'test-key',
        timeout: 10000,
      });
      expect(fs.componentId).toBe('fileSystem');
    });

    it('should initialize toolSet with all tools', () => {
      expect(component.toolSet.size).toBe(15);
      expect(component.toolSet.has('listFiles')).toBe(true);
      expect(component.toolSet.has('readFile')).toBe(true);
      expect(component.toolSet.has('createFile')).toBe(true);
      expect(component.toolSet.has('updateFile')).toBe(true);
      expect(component.toolSet.has('deleteFile')).toBe(true);
      expect(component.toolSet.has('moveFile')).toBe(true);
      expect(component.toolSet.has('copyFile')).toBe(true);
      expect(component.toolSet.has('fileExists')).toBe(true);
      expect(component.toolSet.has('getFileMetadata')).toBe(true);
      expect(component.toolSet.has('readMarkdownByPage')).toBe(true);
      expect(component.toolSet.has('editMarkdownReplace')).toBe(true);
      expect(component.toolSet.has('editMarkdownInsert')).toBe(true);
      expect(component.toolSet.has('editMarkdownDelete')).toBe(true);
      expect(component.toolSet.has('convertToMarkdown')).toBe(true);
      expect(component.toolSet.has('convertToText')).toBe(true);
    });
  });

  // ==================== Tool Call Handler ====================

  describe('handleToolCall', () => {
    it('should return error for unknown tool', async () => {
      const result = await component.handleToolCall('unknownTool', {});
      expect(result.success).toBe(false);
      expect(result.data).toHaveProperty('error');
      expect(result.summary).toContain('Unknown tool');
    });

    it('should handle listFiles tool', async () => {
      const mockResponse: FileListResponse = {
        success: true,
        message: 'Files retrieved',
        files: [
          { s3_key: 'test/file1.md', file_name: 'file1.md', content_type: 'text/markdown', file_size: 100 },
        ],
        total: 1,
        limit: 20,
        offset: 0,
        has_more: false,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await component.handleToolCall('listFiles', { prefix: 'test/', limit: 20 });
      expect(result.success).toBe(true);
      expect(result.data.files).toHaveLength(1);
      expect(result.summary).toContain('1/1 files');
    });

    it('should handle readFile tool', async () => {
      const mockResponse: FileReadResponse = {
        success: true,
        s3_key: 'test/file1.md',
        content: '# Hello World',
        file_size: 12,
        encoding: 'utf-8',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await component.handleToolCall('readFile', { s3Key: 'test/file1.md', encoding: 'utf-8' });
      expect(result.success).toBe(true);
      expect(result.data.content).toBe('# Hello World');
    });

    it('should handle createFile tool', async () => {
      const mockResponse: FileCreateResponse = {
        success: true,
        message: 'File created',
        s3_key: 'test/newfile.md',
        content_type: 'text/markdown',
        file_size: 20,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await component.handleToolCall('createFile', {
        s3Key: 'test/newfile.md',
        content: '# New File Content',
        contentType: 'text/markdown',
      });
      expect(result.success).toBe(true);
      expect(result.data.s3_key).toBe('test/newfile.md');
    });

    it('should handle updateFile tool', async () => {
      const mockResponse: FileUpdateResponse = {
        success: true,
        message: 'File updated',
        s3_key: 'test/file1.md',
        mode: 'overwrite',
        file_size: 25,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await component.handleToolCall('updateFile', {
        s3Key: 'test/file1.md',
        content: '# Updated Content',
        mode: 'overwrite',
      });
      expect(result.success).toBe(true);
      expect(result.data.file_size).toBe(25);
    });

    it('should handle deleteFile tool', async () => {
      const mockResponse: FileDeleteResponse = {
        success: true,
        message: 'File deleted',
        s3_key: 'test/file1.md',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await component.handleToolCall('deleteFile', { s3Key: 'test/file1.md' });
      expect(result.success).toBe(true);
      expect(result.data.s3_key).toBe('test/file1.md');
    });

    it('should handle moveFile tool', async () => {
      const mockResponse: FileMoveResponse = {
        success: true,
        message: 'File moved',
        s3_key: 'test/oldname.md',
        new_s3_key: 'test/newname.md',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await component.handleToolCall('moveFile', {
        s3Key: 'test/oldname.md',
        newS3Key: 'test/newname.md',
      });
      expect(result.success).toBe(true);
      expect(result.data.new_s3_key).toBe('test/newname.md');
    });

    it('should handle copyFile tool', async () => {
      const mockResponse: FileCopyResponse = {
        success: true,
        message: 'File copied',
        s3_key: 'test/original.md',
        new_s3_key: 'test/copy.md',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await component.handleToolCall('copyFile', {
        s3Key: 'test/original.md',
        newS3Key: 'test/copy.md',
      });
      expect(result.success).toBe(true);
      expect(result.data.new_s3_key).toBe('test/copy.md');
    });

    it('should handle fileExists tool - exists', async () => {
      const mockResponse: FileExistsResponse = {
        success: true,
        exists: true,
        s3_key: 'test/file1.md',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await component.handleToolCall('fileExists', { s3Key: 'test/file1.md' });
      expect(result.success).toBe(true);
      expect(result.data.exists).toBe(true);
    });

    it('should handle fileExists tool - not exists', async () => {
      const mockResponse: FileExistsResponse = {
        success: true,
        exists: false,
        s3_key: 'test/nonexistent.md',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await component.handleToolCall('fileExists', { s3Key: 'test/nonexistent.md' });
      expect(result.success).toBe(true);
      expect(result.data.exists).toBe(false);
    });

    it('should handle getFileMetadata tool', async () => {
      const mockListResponse: FileListResponse = {
        success: true,
        message: 'Files retrieved',
        files: [
          { s3_key: 'test/file1.md', file_name: 'file1.md', content_type: 'text/markdown', file_size: 100 },
        ],
        total: 1,
        limit: 1,
        offset: 0,
        has_more: false,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockListResponse),
      });

      const result = await component.handleToolCall('getFileMetadata', { s3Key: 'test/file1.md' });
      expect(result.success).toBe(true);
      expect(result.data.s3_key).toBe('test/file1.md');
      expect(result.data.file_size).toBe(100);
    });

    it('should handle readMarkdownByPage tool', async () => {
      const mockResponse: MarkdownPageResponse = {
        metadata: {
          s3_key: 'test/doc.md',
          file_name: 'doc.md',
          total_lines: 1000,
          total_pages: 2,
        },
        page: 1,
        content: '# Document Content\n\nLine 1\nLine 2',
        start_line: 0,
        end_line: 999,
        has_next: true,
        has_previous: false,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await component.handleToolCall('readMarkdownByPage', {
        s3Key: 'test/doc.md',
        page: 1,
        pageSize: 1000,
      });
      expect(result.success).toBe(true);
      expect(result.data.page).toBe(1);
      expect(result.data.has_next).toBe(true);
    });

    it('should handle editMarkdownReplace tool', async () => {
      const mockResponse: MarkdownEditResponse = {
        success: true,
        message: 'Content replaced',
        s3_key: 'test/doc.md',
        old_line_count: 100,
        new_line_count: 110,
        lines_changed: 10,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await component.handleToolCall('editMarkdownReplace', {
        s3Key: 'test/doc.md',
        startLine: 10,
        endLine: 20,
        newContent: '# Replaced Section',
      });
      expect(result.success).toBe(true);
      expect(result.data.lines_changed).toBe(10);
    });

    it('should handle editMarkdownInsert tool', async () => {
      const mockResponse: MarkdownEditResponse = {
        success: true,
        message: 'Content inserted',
        s3_key: 'test/doc.md',
        old_line_count: 100,
        new_line_count: 105,
        lines_changed: 5,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await component.handleToolCall('editMarkdownInsert', {
        s3Key: 'test/doc.md',
        content: '# Inserted Section',
        position: 'start',
      });
      expect(result.success).toBe(true);
    });

    it('should handle editMarkdownDelete tool', async () => {
      const mockResponse: MarkdownEditResponse = {
        success: true,
        message: 'Content deleted',
        s3_key: 'test/doc.md',
        old_line_count: 100,
        new_line_count: 90,
        lines_changed: 10,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await component.handleToolCall('editMarkdownDelete', {
        s3Key: 'test/doc.md',
        startLine: 10,
        endLine: 19,
      });
      expect(result.success).toBe(true);
      expect(result.data.lines_changed).toBe(10);
    });

    it('should handle convertToMarkdown tool', async () => {
      const mockResponse: ConversionResponse = {
        success: true,
        message: 'Conversion started',
        s3_key: 'test/document.pdf',
        file_name: 'document.pdf',
        file_type: 'pdf',
        output_format: 'MARKDOWN',
        status: 'PENDING',
        total_pages: 10,
        processing_time_ms: 0,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await component.handleToolCall('convertToMarkdown', {
        s3Key: 'test/document.pdf',
        targetS3Key: 'test/document.md',
      });
      expect(result.success).toBe(true);
      expect(result.data.output_format).toBe('MARKDOWN');
    });

    it('should handle convertToText tool', async () => {
      const mockResponse: ConversionResponse = {
        success: true,
        message: 'Conversion started',
        s3_key: 'test/document.pdf',
        file_name: 'document.pdf',
        file_type: 'pdf',
        output_format: 'TEXT',
        status: 'PENDING',
        total_pages: 10,
        processing_time_ms: 0,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await component.handleToolCall('convertToText', {
        s3Key: 'test/document.pdf',
      });
      expect(result.success).toBe(true);
      expect(result.data.output_format).toBe('TEXT');
    });
  });

  // ==================== Error Handling ====================

  describe('Error Handling', () => {
    it('should handle HTTP errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ detail: 'File not found' }),
      });

      const result = await component.handleToolCall('readFile', { s3Key: 'test/nonexistent.md', encoding: 'utf-8' });
      expect(result.success).toBe(false);
      expect(result.data).toHaveProperty('error');
      expect(result.summary).toContain('Error');
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await component.handleToolCall('listFiles', { prefix: '', limit: 10 });
      expect(result.success).toBe(false);
      expect(result.data).toHaveProperty('error');
    });

    it('should handle malformed JSON responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.reject(new Error('Invalid JSON')),
      });

      const result = await component.handleToolCall('listFiles', { prefix: '', limit: 10 });
      expect(result.success).toBe(false);
    });
  });

  // ==================== Hook API ====================

  describe('getHooks()', () => {
    beforeEach(() => {
      // Setup default mock responses for hook tests
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });
    });

    it('should return hook API object', () => {
      const hooks = component.getHooks();
      expect(hooks).toHaveProperty('exists');
      expect(hooks).toHaveProperty('read');
      expect(hooks).toHaveProperty('write');
      expect(hooks).toHaveProperty('list');
      expect(hooks).toHaveProperty('delete');
      expect(hooks).toHaveProperty('createPath');
    });

    it('should implement exists hook', async () => {
      const existsResponse: FileExistsResponse = {
        success: true,
        exists: true,
        s3_key: 'test/file.md',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(existsResponse),
      });

      const hooks = component.getHooks();
      const result = await hooks.exists('test/file.md');
      expect(result).toBe(true);
    });

    it('should implement read hook', async () => {
      const readResponse: FileReadResponse = {
        success: true,
        s3_key: 'test/file.md',
        content: '# Content',
        file_size: 10,
        encoding: 'utf-8',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(readResponse),
      });

      const hooks = component.getHooks();
      const content = await hooks.read('test/file.md');
      expect(content).toBe('# Content');
    });

    it('should implement write hook', async () => {
      const createResponse: FileCreateResponse = {
        success: true,
        message: 'Created',
        s3_key: 'test/newfile.md',
        content_type: 'text/plain',
        file_size: 10,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(createResponse),
      });

      const hooks = component.getHooks();
      const result = await hooks.write('test/newfile.md', 'Hello World');
      expect(result.success).toBe(true);
      expect(result.s3_key).toBe('test/newfile.md');
    });

    it('should implement list hook', async () => {
      const listResponse: FileListResponse = {
        success: true,
        message: 'OK',
        files: [
          { s3_key: 'test/file1.md', file_name: 'file1.md', content_type: 'text/markdown', file_size: 100 },
          { s3_key: 'test/file2.md', file_name: 'file2.md', content_type: 'text/markdown', file_size: 200 },
        ],
        total: 2,
        limit: 20,
        offset: 0,
        has_more: false,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(listResponse),
      });

      const hooks = component.getHooks();
      const files = await hooks.list('test/');
      expect(files).toHaveLength(2);
      expect(files[0].s3_key).toBe('test/file1.md');
    });

    it('should implement delete hook', async () => {
      const deleteResponse: FileDeleteResponse = {
        success: true,
        message: 'Deleted',
        s3_key: 'test/file.md',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(deleteResponse),
      });

      const hooks = component.getHooks();
      const result = await hooks.delete('test/file.md');
      expect(result.success).toBe(true);
    });

    it('should implement createPath hook', () => {
      const hooks = component.getHooks();
      const path = hooks.createPath('test-file.md', 'markdown');

      expect(path).toContain('test-files/');
      expect(path).toContain('markdown/');
      expect(path).toContain('test-file.md');
    });

    it('should create path with default type', () => {
      const hooks = component.getHooks();
      const path = hooks.createPath('document.pdf');

      expect(path).toContain('document.pdf');
    });
  });

  // ==================== State Management ====================

  describe('State Management', () => {
    it('should track recent operations', async () => {
      const mockResponse: FileListResponse = {
        success: true,
        message: 'OK',
        files: [],
        total: 0,
        limit: 10,
        offset: 0,
        has_more: false,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      await component.handleToolCall('listFiles', { prefix: '', limit: 10 });

      const state = (component as any).componentState;
      expect(state.recentOperations.length).toBeGreaterThan(0);
      expect(state.recentOperations[0].operation).toBe('listFiles');
    });

    it('should update state with file list', async () => {
      const mockResponse: FileListResponse = {
        success: true,
        message: 'OK',
        files: [
          { s3_key: 'test/file1.md', file_name: 'file1.md', content_type: 'text/markdown', file_size: 100 },
        ],
        total: 1,
        limit: 20,
        offset: 0,
        has_more: false,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      await component.handleToolCall('listFiles', { prefix: '', limit: 10 });

      const state = (component as any).componentState;
      expect(state.files).toHaveLength(1);
      expect(state.totalFiles).toBe(1);
    });

    it('should track active file', async () => {
      const mockResponse: FileReadResponse = {
        success: true,
        s3_key: 'test/active.md',
        content: '# Active File',
        file_size: 15,
        encoding: 'utf-8',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      await component.handleToolCall('readFile', { s3Key: 'test/active.md', encoding: 'utf-8' });

      const state = (component as any).componentState;
      expect(state.activeFile).toBe('test/active.md');
    });
  });

  // ==================== Rendering ====================

  describe('renderImply', () => {
    it('should render without errors', async () => {
      const elements = await component.renderImply();
      expect(elements).toBeDefined();
      expect(Array.isArray(elements)).toBe(true);
      expect(elements.length).toBeGreaterThan(0);
    });

    it('should render with file list', async () => {
      const mockResponse: FileListResponse = {
        success: true,
        message: 'OK',
        files: [
          { s3_key: 'test/file1.md', file_name: 'file1.md', content_type: 'text/markdown', file_size: 100 },
        ],
        total: 1,
        limit: 20,
        offset: 0,
        has_more: false,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      await component.handleToolCall('listFiles', { prefix: '', limit: 10 });
      const elements = await component.renderImply();

      expect(elements).toBeDefined();
    });
  });

  // ==================== API Request Builder ====================

  describe('API Request Building', () => {
    it('should build correct URL for editor endpoints', async () => {
      const mockResponse: FileListResponse = {
        success: true,
        message: 'OK',
        files: [],
        total: 0,
        limit: 10,
        offset: 0,
        has_more: false,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      await component.handleToolCall('listFiles', { prefix: 'test/', limit: 10 });

      const callArgs = mockFetch.mock.calls[0];
      const calledUrl = callArgs[0] as string;
      expect(calledUrl).toContain('http://localhost:8000/api/v1/editor/list');
      expect(calledUrl).toContain('prefix=');
      expect(calledUrl).toContain('limit=10');
      expect(callArgs[1]).toMatchObject({ method: 'GET' });
    });

    it('should include API key in headers when configured', async () => {
      const componentWithKey = new FileSystemComponent({
        baseUrl: mockBaseUrl,
        apiKey: 'test-api-key',
      });

      const mockResponse: FileExistsResponse = {
        success: true,
        exists: true,
        s3_key: 'test/file.md',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      await componentWithKey.handleToolCall('fileExists', { s3Key: 'test/file.md' });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({ 'X-API-Key': 'test-api-key' }),
        })
      );
    });

    it('should send JSON body for POST requests', async () => {
      const mockResponse: FileCreateResponse = {
        success: true,
        message: 'Created',
        s3_key: 'test/newfile.md',
        content_type: 'text/plain',
        file_size: 10,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      await component.handleToolCall('createFile', {
        s3Key: 'test/newfile.md',
        content: 'Hello',
        contentType: 'text/plain',
      });

      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs[0]).toBe('http://localhost:8000/api/v1/editor/create');
      expect(callArgs[1].method).toBe('POST');

      const body = JSON.parse(callArgs[1].body);
      expect(body.s3_key).toBe('test/newfile.md');
      expect(body.content).toBe('Hello');
      expect(body.content_type).toBe('text/plain');
    });
  });

  // ==================== Config ====================

  describe('Configuration', () => {
    it('should use default timeout', () => {
      const fs = new FileSystemComponent({ baseUrl: mockBaseUrl });
      expect((fs as any).config.timeout).toBe(30000);
    });

    it('should use custom timeout', () => {
      const fs = new FileSystemComponent({ baseUrl: mockBaseUrl, timeout: 60000 });
      expect((fs as any).config.timeout).toBe(60000);
    });

    it('should use default prefix', () => {
      const fs = new FileSystemComponent({ baseUrl: mockBaseUrl });
      expect((fs as any).config.defaultPrefix).toBe('agent-files/');
    });

    it('should use custom prefix', () => {
      const fs = new FileSystemComponent({ baseUrl: mockBaseUrl, defaultPrefix: 'custom/' });
      expect((fs as any).config.defaultPrefix).toBe('custom/');
    });

    it('should use default content type', () => {
      const fs = new FileSystemComponent({ baseUrl: mockBaseUrl });
      expect((fs as any).config.defaultContentType).toBe('text/plain');
    });
  });
});

// ==================== Factory Function Tests ====================

describe('createFileSystemComponent', () => {
  it('should create component via factory', () => {
    const fs = createFileSystemComponent({ baseUrl: 'http://localhost:8000' });
    expect(fs).toBeInstanceOf(FileSystemComponent);
  });
});
