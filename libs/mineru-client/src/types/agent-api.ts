export interface AgentUrlParseRequest {
  url: string;
  language?: string;
  page_range?: string;
}

export interface AgentFileUploadResponse {
  task_id: string;
  file_url: string;
}

export type AgentTaskState =
  | 'waiting-file'
  | 'uploading'
  | 'pending'
  | 'running'
  | 'done'
  | 'failed';

export interface AgentTaskResult {
  task_id: string;
  state: AgentTaskState;
  markdown?: string;
  err_msg?: string;
}
