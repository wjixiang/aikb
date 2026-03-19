/**
 * FileSystem Component Module
 *
 * Cloud file storage component for agent file management.
 * Provides file CRUD, markdown editing, and format conversion tools.
 */

// Component and factory
export {
  FileSystemComponent,
  createFileSystemComponent,
  type FileSystemComponentConfig,
  type FileSystemComponentState,
  type FileSystemHooks,
} from './fileSystem.component.js';

// Schemas
export {
  fileSystemToolSchemas,
  listFilesParamsSchema,
  readFileParamsSchema,
  createFileParamsSchema,
  updateFileParamsSchema,
  deleteFileParamsSchema,
  moveFileParamsSchema,
  copyFileParamsSchema,
  fileExistsParamsSchema,
  getFileMetadataParamsSchema,
  readMarkdownByPageParamsSchema,
  editMarkdownReplaceParamsSchema,
  editMarkdownInsertParamsSchema,
  editMarkdownDeleteParamsSchema,
  convertToMarkdownParamsSchema,
  convertToTextParamsSchema,
  type FileSystemToolName,
  type FileSystemToolReturnTypes,
  type ToolReturnType,
} from './fileSystemSchemas.js';

// Types
export type {
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
  FileMetadata,
  MarkdownPageResponse,
  MarkdownMetadata,
  MarkdownEditResponse,
  ConversionResponse,
  ConversionStatus,
  OutputFormat,
  FileSystemError,
} from './fileSystem.types.js';
