export interface FileCreateResponse {
  success: boolean;
  message: string;
  s3_key: string;
  content_type: string;
  file_size: number;
}

export interface FileUpdateResponse {
  success: boolean;
  message: string;
  s3_key: string;
  mode: 'overwrite' | 'append' | 'prepend';
  file_size: number;
}

export interface FileDeleteResponse {
  success: boolean;
  message: string;
  s3_key: string;
}

export interface FileCopyResponse {
  success: boolean;
  message: string;
  s3_key: string;
  new_s3_key: string;
}

export interface FileExistsResponse {
  success: boolean;
  exists: boolean;
  s3_key: string;
}

export interface FileMetadataResponse {
  success: boolean;
  s3_key: string;
  content_type: string;
  file_size: number;
  modified_at?: string;
}

export interface MarkdownMetadata {
  s3_key: string;
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

export interface MarkdownEditResponse {
  success: boolean;
  message: string;
  s3_key: string;
  old_line_count: number;
  new_line_count: number;
  lines_changed: number;
}
