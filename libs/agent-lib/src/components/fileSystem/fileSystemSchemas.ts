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
    desc: 'List files with optional prefix filter and pagination',
    paramsSchema: listFilesParamsSchema,
  },
  readFile: {
    toolName: 'readFile',
    desc: 'Read file content from S3 storage',
    paramsSchema: readFileParamsSchema,
  },
  createFile: {
    toolName: 'createFile',
    desc: 'Create a new file in S3 storage',
    paramsSchema: createFileParamsSchema,
  },
  updateFile: {
    toolName: 'updateFile',
    desc: 'Update file content (overwrite, append, or prepend)',
    paramsSchema: updateFileParamsSchema,
  },
  deleteFile: {
    toolName: 'deleteFile',
    desc: 'Delete a file from S3 storage',
    paramsSchema: deleteFileParamsSchema,
  },
  moveFile: {
    toolName: 'moveFile',
    desc: 'Move or rename a file in S3 storage',
    paramsSchema: moveFileParamsSchema,
  },
  copyFile: {
    toolName: 'copyFile',
    desc: 'Copy a file to a new location in S3 storage',
    paramsSchema: copyFileParamsSchema,
  },
  fileExists: {
    toolName: 'fileExists',
    desc: 'Check if a file exists in S3 storage',
    paramsSchema: fileExistsParamsSchema,
  },
  getFileMetadata: {
    toolName: 'getFileMetadata',
    desc: 'Get file metadata from S3 storage',
    paramsSchema: getFileMetadataParamsSchema,
  },
  readMarkdownByPage: {
    toolName: 'readMarkdownByPage',
    desc: 'Read markdown file with pagination',
    paramsSchema: readMarkdownByPageParamsSchema,
  },
  editMarkdownReplace: {
    toolName: 'editMarkdownReplace',
    desc: 'Replace content in specified line range',
    paramsSchema: editMarkdownReplaceParamsSchema,
  },
  editMarkdownInsert: {
    toolName: 'editMarkdownInsert',
    desc: 'Insert content at specified position',
    paramsSchema: editMarkdownInsertParamsSchema,
  },
  editMarkdownDelete: {
    toolName: 'editMarkdownDelete',
    desc: 'Delete content in specified line range',
    paramsSchema: editMarkdownDeleteParamsSchema,
  },
  convertToMarkdown: {
    toolName: 'convertToMarkdown',
    desc: 'Convert a file to Markdown format using Docling',
    paramsSchema: convertToMarkdownParamsSchema,
  },
  convertToText: {
    toolName: 'convertToText',
    desc: 'Convert a file to plain text format using Docling',
    paramsSchema: convertToTextParamsSchema,
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
