// ==================== Request Types ====================

export interface SingleFileRequest {
  url: string;
  is_ocr?: boolean;
  enable_formula?: boolean;
  enable_table?: boolean;
  language?: string;
  data_id?: string;
  callback?: string;
  seed?: string;
  extra_formats?: ('docx' | 'html' | 'latex')[];
  page_ranges?: string;
  model_version?: 'pipeline' | 'vlm' | 'MinerU-HTML';
}

export interface BatchFileRequest {
  enable_formula?: boolean;
  enable_table?: boolean;
  language?: string;
  callback?: string;
  seed?: string;
  extra_formats?: ('docx' | 'html' | 'latex')[];
  model_version?: 'pipeline' | 'vlm' | 'MinerU-HTML';
  files: BatchFileItem[];
}

export interface BatchFileItem {
  name: string;
  is_ocr?: boolean;
  data_id?: string;
  page_ranges?: string;
}

export interface BatchUrlRequest {
  enable_formula?: boolean;
  enable_table?: boolean;
  language?: string;
  callback?: string;
  seed?: string;
  extra_formats?: ('docx' | 'html' | 'latex')[];
  model_version?: 'pipeline' | 'vlm' | 'MinerU-HTML';
  files: BatchUrlItem[];
}

export interface BatchUrlItem {
  url: string;
  is_ocr?: boolean;
  data_id?: string;
  page_ranges?: string;
}

// ==================== Response Types ====================

export interface SingleFileResponse {
  task_id: string;
  [key: string]: any;
}

export interface BatchFileResponse {
  batch_id: string;
  file_urls: string[];
}

export interface BatchUrlResponse {
  batch_id: string;
}

export interface ExtractProgress {
  extracted_pages: number;
  total_pages: number;
  start_time: string;
}

export type PrecisionTaskState =
  | 'done'
  | 'pending'
  | 'running'
  | 'failed'
  | 'converting'
  | 'waiting-file';

export interface TaskResult {
  task_id?: string;
  data_id?: string;
  file_name?: string;
  state: PrecisionTaskState;
  full_zip_url?: string;
  err_msg?: string;
  extract_progress?: ExtractProgress;
}

export interface BatchTaskResult {
  batch_id: string;
  extract_result: TaskResult[];
}

export interface FileUploadInfo {
  fileName: string;
  filePath: string;
  uploadUrl: string;
  s3Url?: string;
}
