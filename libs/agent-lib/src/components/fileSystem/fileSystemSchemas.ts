import { z } from 'zod';

/**
 * FileSystem Component Configuration
 */
export interface FileSystemComponentConfig {
  /** File-renderer service base URL */
  baseUrl: string;
  /** Default file prefix for new files (e.g., "agent-files/") */
  defaultPrefix?: string;
  /** API key for authentication (if required) */
  apiKey?: string;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Default content type for created files */
  defaultContentType?: string;
}

// ==================== Parameter Schemas ====================

// List Files
export const listFilesParamsSchema = z.object({
  prefix: z.string().default('').describe('File path prefix filter'),
  filterType: z.enum(['all', 'text', 'markdown', 'json', 'pdf', 'image']).default('all').describe('File type filter'),
  limit: z.number().default(20).describe('Number of files to return'),
  offset: z.number().default(0).describe('Number of files to skip'),
  includeMetadata: z.boolean().default(false).describe('Include file metadata'),
});

export type ListFilesParams = z.infer<typeof listFilesParamsSchema>;

// Read File
export const readFileParamsSchema = z.object({
  s3Key: z.string().describe('S3 storage path'),
  encoding: z.string().default('utf-8').describe('Content encoding'),
});

export type ReadFileParams = z.infer<typeof readFileParamsSchema>;

// Create File
export const createFileParamsSchema = z.object({
  s3Key: z.string().describe('S3 storage path'),
  content: z.string().describe('File content'),
  contentType: z.string().default('text/plain').describe('MIME content type'),
  encoding: z.string().default('utf-8').describe('Content encoding'),
});

export type CreateFileParams = z.infer<typeof createFileParamsSchema>;

// Update File
export const updateFileParamsSchema = z.object({
  s3Key: z.string().describe('S3 storage path'),
  content: z.string().describe('New content'),
  mode: z.enum(['overwrite', 'append', 'prepend']).default('overwrite').describe('Update mode'),
  encoding: z.string().default('utf-8').describe('Content encoding'),
});

export type UpdateFileParams = z.infer<typeof updateFileParamsSchema>;

// Delete File
export const deleteFileParamsSchema = z.object({
  s3Key: z.string().describe('S3 storage path'),
});

export type DeleteFileParams = z.infer<typeof deleteFileParamsSchema>;

// Move File
export const moveFileParamsSchema = z.object({
  s3Key: z.string().describe('Source S3 path'),
  newS3Key: z.string().describe('Destination S3 path'),
});

export type MoveFileParams = z.infer<typeof moveFileParamsSchema>;

// Copy File
export const copyFileParamsSchema = z.object({
  s3Key: z.string().describe('Source S3 path'),
  newS3Key: z.string().describe('Destination S3 path'),
});

export type CopyFileParams = z.infer<typeof copyFileParamsSchema>;

// File Exists
export const fileExistsParamsSchema = z.object({
  s3Key: z.string().describe('S3 storage path'),
});

export type FileExistsParams = z.infer<typeof fileExistsParamsSchema>;

// Get File Metadata
export const getFileMetadataParamsSchema = z.object({
  s3Key: z.string().describe('S3 storage path'),
});

export type GetFileMetadataParams = z.infer<typeof getFileMetadataParamsSchema>;

// Read Markdown By Page
export const readMarkdownByPageParamsSchema = z.object({
  s3Key: z.string().describe('S3 storage path'),
  page: z.number().default(1).describe('Page number (1-based)'),
  pageSize: z.number().default(1000).describe('Lines per page'),
});

export type ReadMarkdownByPageParams = z.infer<typeof readMarkdownByPageParamsSchema>;

// Edit Markdown Replace
export const editMarkdownReplaceParamsSchema = z.object({
  s3Key: z.string().describe('S3 storage path'),
  startLine: z.number().describe('Start line (0-based)'),
  endLine: z.number().describe('End line (inclusive)'),
  newContent: z.string().describe('New content to replace with'),
});

export type EditMarkdownReplaceParams = z.infer<typeof editMarkdownReplaceParamsSchema>;

// Edit Markdown Insert
export const editMarkdownInsertParamsSchema = z.object({
  s3Key: z.string().describe('S3 storage path'),
  content: z.string().describe('Content to insert'),
  position: z.enum(['start', 'end', 'before_line', 'after_line']).describe('Insert position'),
  targetLine: z.number().optional().describe('Target line for before_line/after_line'),
});

export type EditMarkdownInsertParams = z.infer<typeof editMarkdownInsertParamsSchema>;

// Edit Markdown Delete
export const editMarkdownDeleteParamsSchema = z.object({
  s3Key: z.string().describe('S3 storage path'),
  startLine: z.number().describe('Start line (0-based)'),
  endLine: z.number().describe('End line (inclusive)'),
});

export type EditMarkdownDeleteParams = z.infer<typeof editMarkdownDeleteParamsSchema>;

// Convert To Markdown
export const convertToMarkdownParamsSchema = z.object({
  s3Key: z.string().describe('Source file S3 path'),
  targetS3Key: z.string().optional().describe('Target markdown S3 path'),
  forceRefresh: z.boolean().default(false).describe('Force refresh cache'),
});

export type ConvertToMarkdownParams = z.infer<typeof convertToMarkdownParamsSchema>;

// Convert To Text
export const convertToTextParamsSchema = z.object({
  s3Key: z.string().describe('Source file S3 path'),
  targetS3Key: z.string().optional().describe('Target text S3 path'),
  forceRefresh: z.boolean().default(false).describe('Force refresh cache'),
});

export type ConvertToTextParams = z.infer<typeof convertToTextParamsSchema>;

// ==================== Tool Schemas Map ====================

export const fileSystemToolSchemas = {
  listFiles: {
    toolName: 'listFiles',
    desc: 'List files in S3 storage with optional prefix filter and pagination.',
    paramsSchema: listFilesParamsSchema,
    examples: [
      {
        description: 'List all files with pagination',
        params: { prefix: '', limit: 20, offset: 0 },
        expectedResult: 'Returns list of files with s3Key, size, lastModified, contentType',
      },
      {
        description: 'List markdown files only',
        params: { prefix: 'docs/', filterType: 'markdown', limit: 50 },
        expectedResult: 'Returns only .md files under docs/ prefix',
      },
      {
        description: 'List files with metadata',
        params: { prefix: 'agent-files/', includeMetadata: true },
        expectedResult: 'Returns files with full metadata including ETag, storage class',
      },
    ],
  },
  readFile: {
    toolName: 'readFile',
    desc: 'Read complete file content from S3 storage. For large files, use readMarkdownByPage instead.',
    paramsSchema: readFileParamsSchema,
    examples: [
      {
        description: 'Read a text file',
        params: { s3Key: 'agent-files/report.txt', encoding: 'utf-8' },
        expectedResult: 'Returns file content as string',
      },
      {
        description: 'Read a JSON file',
        params: { s3Key: 'agent-files/config.json', encoding: 'utf-8' },
        expectedResult: 'Returns JSON file content',
      },
    ],
  },
  createFile: {
    toolName: 'createFile',
    desc: 'Create a new file in S3 storage. Fails if file already exists.',
    paramsSchema: createFileParamsSchema,
    examples: [
      {
        description: 'Create a text file',
        params: {
          s3Key: 'agent-files/output.txt',
          content: 'Hello, world!',
          contentType: 'text/plain',
        },
        expectedResult: 'File created, returns { success: true }',
      },
      {
        description: 'Create a JSON file',
        params: {
          s3Key: 'agent-files/data.json',
          content: '{"key": "value"}',
          contentType: 'application/json',
        },
      },
    ],
  },
  updateFile: {
    toolName: 'updateFile',
    desc: 'Update file content in S3 storage. Supports overwrite, append, and prepend modes.',
    paramsSchema: updateFileParamsSchema,
    examples: [
      {
        description: 'Overwrite file content',
        params: {
          s3Key: 'agent-files/log.txt',
          content: 'New log content',
          mode: 'overwrite',
        },
        expectedResult: 'File content replaced',
      },
      {
        description: 'Append to file',
        params: {
          s3Key: 'agent-files/log.txt',
          content: '\nNew log entry',
          mode: 'append',
        },
        expectedResult: 'Content added to end of file',
      },
      {
        description: 'Prepend to file',
        params: {
          s3Key: 'agent-files/log.txt',
          content: 'Header line\n',
          mode: 'prepend',
        },
        expectedResult: 'Content added to beginning of file',
      },
    ],
  },
  deleteFile: {
    toolName: 'deleteFile',
    desc: 'Delete a file from S3 storage permanently.',
    paramsSchema: deleteFileParamsSchema,
    examples: [
      {
        description: 'Delete a file',
        params: { s3Key: 'agent-files/temp.txt' },
        expectedResult: 'File deleted',
      },
    ],
  },
  moveFile: {
    toolName: 'moveFile',
    desc: 'Move or rename a file in S3 storage. Use to reorganize files or rename.',
    paramsSchema: moveFileParamsSchema,
    examples: [
      {
        description: 'Move file to new location',
        params: {
          s3Key: 'agent-files/old/path.txt',
          newS3Key: 'agent-files/new/path.txt',
        },
        expectedResult: 'File moved to new location',
      },
      {
        description: 'Rename a file',
        params: {
          s3Key: 'agent-files/oldname.txt',
          newS3Key: 'agent-files/newname.txt',
        },
        expectedResult: 'File renamed',
      },
    ],
  },
  copyFile: {
    toolName: 'copyFile',
    desc: 'Copy a file to a new location in S3 storage.',
    paramsSchema: copyFileParamsSchema,
    examples: [
      {
        description: 'Copy file to backup location',
        params: {
          s3Key: 'agent-files/original.txt',
          newS3Key: 'agent-files/backups/original.bak',
        },
        expectedResult: 'File copied to new location',
      },
    ],
  },
  fileExists: {
    toolName: 'fileExists',
    desc: 'Check if a file exists in S3 storage.',
    paramsSchema: fileExistsParamsSchema,
    examples: [
      {
        description: 'Check if file exists',
        params: { s3Key: 'agent-files/data.json' },
        expectedResult: 'Returns { exists: true } or { exists: false }',
      },
    ],
  },
  getFileMetadata: {
    toolName: 'getFileMetadata',
    desc: 'Get file metadata including size, content type, last modified, etc.',
    paramsSchema: getFileMetadataParamsSchema,
    examples: [
      {
        description: 'Get file metadata',
        params: { s3Key: 'agent-files/document.pdf' },
        expectedResult: 'Returns size, contentType, lastModified, ETag, storageClass',
      },
    ],
  },
  readMarkdownByPage: {
    toolName: 'readMarkdownByPage',
    desc: 'Read large markdown files page by page to avoid memory issues.',
    paramsSchema: readMarkdownByPageParamsSchema,
    examples: [
      {
        description: 'Read first page of markdown',
        params: { s3Key: 'agent-files/large-doc.md', page: 1, pageSize: 1000 },
        expectedResult: 'Returns { content: string, page: number, totalPages: number, hasMore: boolean }',
      },
      {
        description: 'Read specific page',
        params: { s3Key: 'agent-files/large-doc.md', page: 5, pageSize: 500 },
        expectedResult: 'Returns page 5 content',
      },
    ],
  },
  editMarkdownReplace: {
    toolName: 'editMarkdownReplace',
    desc: 'Replace content in a markdown file by specifying line range (0-based inclusive indices).',
    paramsSchema: editMarkdownReplaceParamsSchema,
    examples: [
      {
        description: 'Replace lines 10-15 with new content',
        params: {
          s3Key: 'agent-files/doc.md',
          startLine: 10,
          endLine: 15,
          newContent: '## New Section\n\nContent here.',
        },
        expectedResult: 'Lines 10-15 replaced with new content',
      },
    ],
  },
  editMarkdownInsert: {
    toolName: 'editMarkdownInsert',
    desc: 'Insert content at start, end, or before/after a specific line in a markdown file.',
    paramsSchema: editMarkdownInsertParamsSchema,
    examples: [
      {
        description: 'Insert content at end',
        params: {
          s3Key: 'agent-files/doc.md',
          content: '\n\n## Conclusion\n\nFinal paragraph.',
          position: 'end',
        },
        expectedResult: 'Content appended to file',
      },
      {
        description: 'Insert after specific line',
        params: {
          s3Key: 'agent-files/doc.md',
          content: '## New Section\n\nAdded section.',
          position: 'after_line',
          targetLine: 5,
        },
        expectedResult: 'Content inserted after line 5',
      },
    ],
  },
  editMarkdownDelete: {
    toolName: 'editMarkdownDelete',
    desc: 'Delete a range of lines from a markdown file (0-based inclusive indices).',
    paramsSchema: editMarkdownDeleteParamsSchema,
    examples: [
      {
        description: 'Delete lines 20-25',
        params: { s3Key: 'agent-files/doc.md', startLine: 20, endLine: 25 },
        expectedResult: 'Lines 20-25 removed from file',
      },
    ],
  },
  convertToMarkdown: {
    toolName: 'convertToMarkdown',
    desc: 'Convert PDF, DOCX, or other documents to Markdown using Docling. Stores result in S3.',
    paramsSchema: convertToMarkdownParamsSchema,
    examples: [
      {
        description: 'Convert PDF to markdown',
        params: {
          s3Key: 'agent-files/document.pdf',
          targetS3Key: 'agent-files/document.md',
        },
        expectedResult: 'Returns { success: true, s3Key: "agent-files/document.md" }',
      },
      {
        description: 'Convert with cache refresh',
        params: {
          s3Key: 'agent-files/document.pdf',
          targetS3Key: 'agent-files/document.md',
          forceRefresh: true,
        },
        expectedResult: 'Re-converts document, ignoring cache',
      },
    ],
  },
  convertToText: {
    toolName: 'convertToText',
    desc: 'Convert PDF, DOCX, or other documents to plain text using Docling.',
    paramsSchema: convertToTextParamsSchema,
    examples: [
      {
        description: 'Convert PDF to text',
        params: {
          s3Key: 'agent-files/document.pdf',
          targetS3Key: 'agent-files/document.txt',
        },
        expectedResult: 'Returns { success: true, s3Key: "agent-files/document.txt" }',
      },
    ],
  },
};

// ==================== Tool Names ====================

export type FileSystemToolName = keyof typeof fileSystemToolSchemas;

// ==================== Return Types ====================

import type {
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

export interface FileSystemToolReturnTypes {
  listFiles: FileListResponse;
  readFile: FileReadResponse;
  createFile: FileCreateResponse;
  updateFile: FileUpdateResponse;
  deleteFile: FileDeleteResponse;
  moveFile: FileMoveResponse;
  copyFile: FileCopyResponse;
  fileExists: FileExistsResponse;
  getFileMetadata: FileMetadataResponse;
  readMarkdownByPage: MarkdownPageResponse;
  editMarkdownReplace: MarkdownEditResponse;
  editMarkdownInsert: MarkdownEditResponse;
  editMarkdownDelete: MarkdownEditResponse;
  convertToMarkdown: ConversionResponse;
  convertToText: ConversionResponse;
}

export type ToolReturnType<T extends FileSystemToolName> = FileSystemToolReturnTypes[T];
