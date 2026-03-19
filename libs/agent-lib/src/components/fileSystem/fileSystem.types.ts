/**
 * FileSystem Component Type Definitions
 * TypeScript types matching file-renderer API responses
 */

// ==================== File List ====================

export interface FileListItem {
  s3_key: string;
  file_name: string;
  content_type: string;
  file_size: number;
  modified_at?: string;
}

export interface FileListResponse {
  success: boolean;
  message: string;
  files: FileListItem[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

// ==================== File Read ====================

export interface FileReadResponse {
  success: boolean;
  s3_key: string;
  content: string;
  content_type?: string;
  file_size: number;
  encoding: string;
}

// ==================== File Create ====================

export interface FileCreateResponse {
  success: boolean;
  message: string;
  s3_key: string;
  content_type: string;
  file_size: number;
}

// ==================== File Update ====================

export interface FileUpdateResponse {
  success: boolean;
  message: string;
  s3_key: string;
  mode: 'overwrite' | 'append' | 'prepend';
  file_size: number;
}

// ==================== File Delete ====================

export interface FileDeleteResponse {
  success: boolean;
  message: string;
  s3_key: string;
}

// ==================== File Move ====================

export interface FileMoveResponse {
  success: boolean;
  message: string;
  s3_key: string;
  new_s3_key: string;
}

// ==================== File Copy ====================

export interface FileCopyResponse {
  success: boolean;
  message: string;
  s3_key: string;
  new_s3_key: string;
}

// ==================== File Exists ====================

export interface FileExistsResponse {
  success: boolean;
  exists: boolean;
  s3_key: string;
}

// ==================== File Metadata ====================

export interface FileMetadata {
  file_id?: string;
  s3_key: string;
  file_name: string;
  content_type: string;
  file_size: number;
  modified_at?: string;
}

export interface FileMetadataResponse {
  success: boolean;
  s3_key: string;
  file_name: string;
  content_type: string;
  file_size: number;
  modified_at?: string;
}

// ==================== Markdown Page ====================

export interface MarkdownMetadata {
  s3_key: string;
  file_name: string;
  total_lines: number;
  total_pages: number;
}

export interface MarkdownPageResponse {
  metadata: MarkdownMetadata;
  page: number;
  content: string;
  start_line: number;
  end_line: number;
  has_next: boolean;
  has_previous: boolean;
}

// ==================== Markdown Edit ====================

export interface MarkdownEditResponse {
  success: boolean;
  message: string;
  s3_key: string;
  old_line_count: number;
  new_line_count: number;
  lines_changed: number;
}

// ==================== Conversion ====================

export type ConversionStatus = 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED' | 'NOT_FOUND' | 'CANCELLED';
export type OutputFormat = 'MARKDOWN' | 'JSON' | 'HTML' | 'TEXT' | 'DOCTAGS';

export interface ConversionResponse {
  success: boolean;
  message: string;
  s3_key: string;
  file_name: string;
  file_type: string;
  output_format: OutputFormat;
  status: ConversionStatus;
  total_pages: number;
  processing_time_ms: number;
  error_message?: string;
}

// ==================== Generic API Error ====================

export interface FileSystemError {
  error: string;
  detail?: string;
}
