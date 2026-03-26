/**
 * FileSystem Module
 *
 * Provides file management components for agents.
 */

export {
  MarkdownComponent,
  createMarkdownComponent,
  type MarkdownComponentConfig,
  type MarkdownComponentState,
  type MarkdownHooks,
  type MarkdownToolName,
} from './markdown/index.js';

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
} from './markdown/markdownSchemas.js';

export type {
  FileCreateResponse,
  FileUpdateResponse,
  FileDeleteResponse,
  FileCopyResponse,
  FileExistsResponse,
  FileMetadataResponse,
  MarkdownPageResponse,
  MarkdownEditResponse,
} from './markdown/markdown.types.js';
