import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  MarkdownComponent,
  createMarkdownComponent,
} from '../markdown.component.js';
import { ApiClient } from '../../apiClient.js';

describe('MarkdownComponent', () => {
  let component: MarkdownComponent;
  let mockRequest: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequest = vi.fn();

    vi.spyOn(ApiClient.prototype, 'request').mockImplementation(mockRequest);

    component = createMarkdownComponent({
      baseUrl: 'http://localhost:8000',
      defaultPrefix: 'test-markdown/',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create component with correct id', () => {
      expect(component.componentId).toBe('markdown');
    });

    it('should create component with correct display name', () => {
      expect(component.displayName).toBe('Markdown');
    });

    it('should initialize with 10 tools', () => {
      expect(component.toolSet.size).toBe(10);
    });

    it('should initialize with empty state', () => {
      const state = (component as any).componentState;
      expect(state.recentOperations).toEqual([]);
    });
  });

  describe('tool set', () => {
    it('should have createFile tool', () => {
      expect(component.toolSet.has('createFile')).toBe(true);
    });

    it('should have updateFile tool', () => {
      expect(component.toolSet.has('updateFile')).toBe(true);
    });

    it('should have deleteFile tool', () => {
      expect(component.toolSet.has('deleteFile')).toBe(true);
    });

    it('should have copyFile tool', () => {
      expect(component.toolSet.has('copyFile')).toBe(true);
    });

    it('should have fileExists tool', () => {
      expect(component.toolSet.has('fileExists')).toBe(true);
    });

    it('should have getFileMetadata tool', () => {
      expect(component.toolSet.has('getFileMetadata')).toBe(true);
    });

    it('should have readMarkdownByPage tool', () => {
      expect(component.toolSet.has('readMarkdownByPage')).toBe(true);
    });

    it('should have editMarkdownReplace tool', () => {
      expect(component.toolSet.has('editMarkdownReplace')).toBe(true);
    });

    it('should have editMarkdownInsert tool', () => {
      expect(component.toolSet.has('editMarkdownInsert')).toBe(true);
    });

    it('should have editMarkdownDelete tool', () => {
      expect(component.toolSet.has('editMarkdownDelete')).toBe(true);
    });
  });

  describe('handleToolCall - createFile', () => {
    it('should create file successfully', async () => {
      const mockResponse = {
        success: true,
        message: 'File created',
        s3_key: 'new.md',
        content_type: 'text/markdown',
        file_size: 15,
      };

      mockRequest.mockResolvedValueOnce(mockResponse);

      const result = await component.handleToolCall('createFile', {
        s3Key: 'new.md',
        content: '# New File',
        contentType: 'text/markdown',
      });

      expect(result.success).toBe(true);
      expect(result.data.s3_key).toBe('new.md');
      expect(result.data.file_size).toBe(15);
    });
  });

  describe('handleToolCall - updateFile', () => {
    it('should update file successfully', async () => {
      const mockResponse = {
        success: true,
        message: 'File updated',
        s3_key: 'test.md',
        mode: 'overwrite' as const,
        file_size: 20,
      };

      mockRequest.mockResolvedValueOnce(mockResponse);

      const result = await component.handleToolCall('updateFile', {
        s3Key: 'test.md',
        content: '# Updated content',
        mode: 'overwrite',
      });

      expect(result.success).toBe(true);
      expect(result.data.file_size).toBe(20);
    });

    it('should support append mode', async () => {
      const mockResponse = {
        success: true,
        message: 'Content appended',
        s3_key: 'test.md',
        mode: 'append' as const,
        file_size: 30,
      };

      mockRequest.mockResolvedValueOnce(mockResponse);

      const result = await component.handleToolCall('updateFile', {
        s3Key: 'test.md',
        content: '\n# More content',
        mode: 'append',
      });

      expect(result.success).toBe(true);
      expect(result.data.mode).toBe('append');
    });
  });

  describe('handleToolCall - deleteFile', () => {
    it('should delete file successfully', async () => {
      const mockResponse = {
        success: true,
        message: 'File deleted',
        s3_key: 'test.md',
      };

      mockRequest.mockResolvedValueOnce(mockResponse);

      const result = await component.handleToolCall('deleteFile', {
        s3Key: 'test.md',
      });

      expect(result.success).toBe(true);
      expect(result.data.s3_key).toBe('test.md');
    });
  });

  describe('handleToolCall - copyFile', () => {
    it('should copy file successfully', async () => {
      const mockResponse = {
        success: true,
        message: 'File copied',
        s3_key: 'test.md',
        new_s3_key: 'test_copy.md',
      };

      mockRequest.mockResolvedValueOnce(mockResponse);

      const result = await component.handleToolCall('copyFile', {
        s3Key: 'test.md',
        newS3Key: 'test_copy.md',
      });

      expect(result.success).toBe(true);
      expect(result.data.new_s3_key).toBe('test_copy.md');
    });
  });

  describe('handleToolCall - fileExists', () => {
    it('should return true when file exists', async () => {
      const mockResponse = {
        success: true,
        exists: true,
        s3_key: 'test.md',
      };

      mockRequest.mockResolvedValueOnce(mockResponse);

      const result = await component.handleToolCall('fileExists', {
        s3Key: 'test.md',
      });

      expect(result.success).toBe(true);
      expect(result.data.exists).toBe(true);
    });

    it('should return false when file does not exist', async () => {
      const mockResponse = {
        success: true,
        exists: false,
        s3_key: 'nonexistent.md',
      };

      mockRequest.mockResolvedValueOnce(mockResponse);

      const result = await component.handleToolCall('fileExists', {
        s3Key: 'nonexistent.md',
      });

      expect(result.success).toBe(true);
      expect(result.data.exists).toBe(false);
    });
  });

  describe('handleToolCall - getFileMetadata', () => {
    it('should return default metadata (not implemented)', async () => {
      const result = await component.handleToolCall('getFileMetadata', {
        s3Key: 'test.md',
      });

      expect(result.success).toBe(false);
      expect(result.data.s3_key).toBe('test.md');
    });
  });

  describe('handleToolCall - readMarkdownByPage', () => {
    it('should read markdown by page', async () => {
      const mockResponse = {
        metadata: {
          s3_key: 'large.md',
          total_lines: 2000,
          total_pages: 2,
        },
        page: 1,
        content: '# Page 1 content',
        start_line: 0,
        end_line: 999,
        has_next: true,
        has_previous: false,
      };

      mockRequest.mockResolvedValueOnce(mockResponse);

      const result = await component.handleToolCall('readMarkdownByPage', {
        s3Key: 'large.md',
        page: 1,
        pageSize: 1000,
      });
      expect(result.success).toBe(true);
      expect(result.data.page).toBe(1);
      expect(result.data.metadata.total_pages).toBe(2);
      expect(result.data.has_next).toBe(true);
    });
  });

  describe('handleToolCall - editMarkdownReplace', () => {
    it('should replace lines in markdown', async () => {
      const mockResponse = {
        success: true,
        message: 'Lines replaced',
        s3_key: 'test.md',
        old_line_count: 10,
        new_line_count: 8,
        lines_changed: 3,
      };

      mockRequest.mockResolvedValueOnce(mockResponse);

      const result = await component.handleToolCall('editMarkdownReplace', {
        s3Key: 'test.md',
        startLine: 5,
        endLine: 7,
        newContent: '# New section',
      });

      expect(result.success).toBe(true);
      expect(result.data.lines_changed).toBe(3);
    });
  });

  describe('handleToolCall - editMarkdownInsert', () => {
    it('should insert content at end', async () => {
      const mockResponse = {
        success: true,
        message: 'Content inserted',
        s3_key: 'test.md',
        old_line_count: 10,
        new_line_count: 12,
        lines_changed: 2,
      };

      mockRequest.mockResolvedValueOnce(mockResponse);

      const result = await component.handleToolCall('editMarkdownInsert', {
        s3Key: 'test.md',
        content: '\n\n## Conclusion',
        position: 'end',
      });

      expect(result.success).toBe(true);
      expect(result.data.lines_changed).toBe(2);
    });
  });

  describe('handleToolCall - editMarkdownDelete', () => {
    it('should delete lines from markdown', async () => {
      const mockResponse = {
        success: true,
        message: 'Lines deleted',
        s3_key: 'test.md',
        old_line_count: 10,
        new_line_count: 7,
        lines_changed: 3,
      };

      mockRequest.mockResolvedValueOnce(mockResponse);

      const result = await component.handleToolCall('editMarkdownDelete', {
        s3Key: 'test.md',
        startLine: 5,
        endLine: 7,
      });

      expect(result.success).toBe(true);
      expect(result.data.lines_changed).toBe(3);
    });
  });

  describe('handleToolCall - unknown tool', () => {
    it('should return error for unknown tool', async () => {
      const result = await component.handleToolCall('unknownTool', {});

      expect(result.success).toBe(false);
      expect(result.data.error).toBe('Unknown tool: unknownTool');
    });
  });

  describe('state management', () => {
    it('should export state correctly', () => {
      const exported = component.exportState();

      expect(exported.recentOperations).toEqual([]);
      expect(exported.version).toBeDefined();
      expect(exported.updatedAt).toBeDefined();
    });

    it('should restore state correctly', () => {
      const stateToRestore = {
        activeFile: 'restored.md',
        currentMdContent: '# Restored content',
        recentOperations: [
          {
            operation: 'createFile',
            s3Key: 'restored.md',
            timestamp: Date.now(),
            success: true,
          },
        ],
        version: 1,
        updatedAt: Date.now(),
      };

      component.restoreState(stateToRestore);
      const exported = component.exportState();

      expect(exported.activeFile).toBe('restored.md');
      expect(exported.currentMdContent).toBe('# Restored content');
      expect(exported.recentOperations).toHaveLength(1);
    });
  });

  describe('getHooks', () => {
    it('should return hooks API', () => {
      const hooks = component.getHooks();

      expect(hooks.exists).toBeDefined();
      expect(hooks.write).toBeDefined();
      expect(hooks.delete).toBeDefined();
      expect(hooks.createPath).toBeDefined();
    });

    it('should create path with correct format', () => {
      const hooks = component.getHooks();
      const path = hooks.createPath('test-file.md');

      expect(path).toContain('test-file.md');
      expect(path).toContain('markdown/');
    });
  });

  describe('renderImply', () => {
    it('should render without error', async () => {
      const elements = await component.renderImply();

      expect(elements.length).toBeGreaterThan(0);
    });
  });

  describe('exportData', () => {
    it('should export data in JSON format', async () => {
      const exported = await component.exportData();

      expect(exported.format).toBe('json');
      expect(exported.metadata.componentId).toBe('markdown');
      expect(exported.metadata.exportedAt).toBeDefined();
    });
  });
});
