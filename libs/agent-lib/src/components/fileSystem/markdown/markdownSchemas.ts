import { z } from 'zod';

export const createFileParamsSchema = z.object({
  s3Key: z.string().describe('S3 storage path'),
  content: z.string().describe('File content'),
  contentType: z.string().default('text/plain').describe('MIME content type'),
});

export type CreateFileParams = z.infer<typeof createFileParamsSchema>;

export const updateFileParamsSchema = z.object({
  s3Key: z.string().describe('S3 storage path'),
  content: z.string().describe('New content'),
  mode: z
    .enum(['overwrite', 'append', 'prepend'])
    .default('overwrite')
    .describe('Update mode'),
});

export type UpdateFileParams = z.infer<typeof updateFileParamsSchema>;

export const deleteFileParamsSchema = z.object({
  s3Key: z.string().describe('S3 storage path'),
});

export type DeleteFileParams = z.infer<typeof deleteFileParamsSchema>;

export const copyFileParamsSchema = z.object({
  s3Key: z.string().describe('Source S3 path'),
  newS3Key: z.string().describe('Destination S3 path'),
});

export type CopyFileParams = z.infer<typeof copyFileParamsSchema>;

export const fileExistsParamsSchema = z.object({
  s3Key: z.string().describe('S3 storage path'),
});

export type FileExistsParams = z.infer<typeof fileExistsParamsSchema>;

export const getFileMetadataParamsSchema = z.object({
  s3Key: z.string().describe('S3 storage path'),
});

export type GetFileMetadataParams = z.infer<typeof getFileMetadataParamsSchema>;

export const readMarkdownByPageParamsSchema = z.object({
  s3Key: z.string().describe('S3 storage path'),
  page: z.number().default(1).describe('Page number (1-based)'),
  pageSize: z.number().default(1000).describe('Lines per page'),
});

export type ReadMarkdownByPageParams = z.infer<
  typeof readMarkdownByPageParamsSchema
>;

export const editMarkdownReplaceParamsSchema = z.object({
  s3Key: z.string().describe('S3 storage path'),
  startLine: z.number().describe('Start line (0-based)'),
  endLine: z.number().describe('End line (inclusive)'),
  newContent: z.string().describe('New content to replace with'),
});

export type EditMarkdownReplaceParams = z.infer<
  typeof editMarkdownReplaceParamsSchema
>;

export const editMarkdownInsertParamsSchema = z.object({
  s3Key: z.string().describe('S3 storage path'),
  content: z.string().describe('Content to insert'),
  position: z
    .enum(['start', 'end', 'before_line', 'after_line'])
    .describe('Insert position'),
  targetLine: z
    .number()
    .optional()
    .describe('Target line for before_line/after_line'),
});

export type EditMarkdownInsertParams = z.infer<
  typeof editMarkdownInsertParamsSchema
>;

export const editMarkdownDeleteParamsSchema = z.object({
  s3Key: z.string().describe('S3 storage path'),
  startLine: z.number().describe('Start line (0-based)'),
  endLine: z.number().describe('End line (inclusive)'),
});

export type EditMarkdownDeleteParams = z.infer<
  typeof editMarkdownDeleteParamsSchema
>;

export const markdownToolSchemas = {
  createFile: {
    toolName: 'createFile',
    desc: 'Create a new markdown file in storage.',
    paramsSchema: createFileParamsSchema,
    examples: [
      {
        description: 'Create a markdown file',
        params: {
          s3Key: 'notes/new.md',
          content: '# My Notes',
          contentType: 'text/markdown',
        },
        expectedResult: 'File created, returns { success: true }',
      },
    ],
  },
  updateFile: {
    toolName: 'updateFile',
    desc: 'Update markdown file content in storage. Supports overwrite, append, and prepend modes.',
    paramsSchema: updateFileParamsSchema,
    examples: [
      {
        description: 'Overwrite file content',
        params: {
          s3Key: 'notes/todo.md',
          content: 'Updated content',
          mode: 'overwrite',
        },
        expectedResult: 'File content replaced',
      },
    ],
  },
  deleteFile: {
    toolName: 'deleteFile',
    desc: 'Delete a markdown file from storage permanently.',
    paramsSchema: deleteFileParamsSchema,
    examples: [
      {
        description: 'Delete a file',
        params: { s3Key: 'notes/temp.md' },
        expectedResult: 'File deleted',
      },
    ],
  },
  copyFile: {
    toolName: 'copyFile',
    desc: 'Copy a markdown file to a new location in storage.',
    paramsSchema: copyFileParamsSchema,
    examples: [
      {
        description: 'Copy file to backup location',
        params: {
          s3Key: 'notes/original.md',
          newS3Key: 'notes/backups/original.bak.md',
        },
        expectedResult: 'File copied to new location',
      },
    ],
  },
  fileExists: {
    toolName: 'fileExists',
    desc: 'Check if a markdown file exists in storage.',
    paramsSchema: fileExistsParamsSchema,
    examples: [
      {
        description: 'Check if file exists',
        params: { s3Key: 'notes/todo.md' },
        expectedResult: 'Returns { exists: true } or { exists: false }',
      },
    ],
  },
  getFileMetadata: {
    toolName: 'getFileMetadata',
    desc: 'Get markdown file metadata including size, content type, last modified, etc.',
    paramsSchema: getFileMetadataParamsSchema,
    examples: [
      {
        description: 'Get file metadata',
        params: { s3Key: 'notes/todo.md' },
        expectedResult: 'Returns size, contentType, lastModified',
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
        params: { s3Key: 'notes/large-doc.md', page: 1, pageSize: 1000 },
        expectedResult:
          'Returns { content: string, page: number, totalPages: number, hasMore: boolean }',
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
          s3Key: 'notes/doc.md',
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
          s3Key: 'notes/doc.md',
          content: '\n\n## Conclusion\n\nFinal paragraph.',
          position: 'end',
        },
        expectedResult: 'Content appended to file',
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
        params: { s3Key: 'notes/doc.md', startLine: 20, endLine: 25 },
        expectedResult: 'Lines 20-25 removed from file',
      },
    ],
  },
};

export type MarkdownToolName = keyof typeof markdownToolSchemas;
