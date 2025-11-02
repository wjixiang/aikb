import axios from "axios";

type DocStatus = "pending" | "processing" | "processed" | "failed";

interface DocStatusResponse {
  id: string;
  content_summary: string;
  content_length: number;
  status: DocStatus;
  created_at: string;
  updated_at: string;
  chunks_count: number | null;
  error: string | null;
  metadata: Record<string, any> | null;
  file_path: string;
}

interface DocsStatusesResponse {
  statuses: Record<DocStatus, DocStatusResponse[]>;
}

interface InsertResponse {
  status: "success" | "duplicated" | "partial_success" | "failure";
  message: string;
}

export interface QueryRequest {
  query: string;
  mode?: "local" | "global" | "hybrid" | "naive" | "mix" | "bypass";
  only_need_context?: boolean | null;
  only_need_prompt?: boolean | null;
  response_type?: string | null;
  top_k?: number | null;
  max_token_for_text_unit?: number | null;
  max_token_for_global_context?: number | null;
  max_token_for_local_context?: number | null;
  hl_keywords?: string[] | null;
  ll_keywords?: string[] | null;
  conversation_history?: Array<{ role: string; content: string }> | null;
  history_turns?: number | null;
}

interface QueryResponse {
  response: string;
}

interface GraphLabel {
  name: string;
  description: string;
}

interface KnowledgeGraph {
  nodes: Array<{
    id: string;
    label: string;
    properties: Record<string, any>;
  }>;
  edges: Array<{
    source: string;
    target: string;
    label: string;
    properties: Record<string, any>;
  }>;
}

interface OllamaVersion {
  version: string;
}

interface OllamaTag {
  name: string;
  model: string;
  modified_at: string;
  size: number;
  digest: string;
  details: {
    parent_model: string;
    format: string;
    family: string;
    families: string[];
    parameter_size: string;
    quantization_level: string;
  };
}

interface OllamaGenerateRequest {
  model: string;
  prompt: string;
  system?: string | null;
  stream?: boolean;
  options?: Record<string, any> | null;
}

interface OllamaChatRequest {
  model: string;
  messages: Array<{
    role: string;
    content: string;
    images?: string[] | null;
  }>;
  stream?: boolean;
  options?: Record<string, any> | null;
  system?: string | null;
}

interface OllamaMessage {
  role: string;
  content: string;
  images?: string[] | null;
}

interface AuthStatus {
  authenticated: boolean;
  username?: string;
}

interface LoginRequest {
  grant_type?: string | null;
  username: string;
  password: string;
  scope?: string;
  client_id?: string | null;
  client_secret?: string | null;
}

interface HealthStatus {
  status: string;
  version: string;
  uptime: number;
}

export class LightRAGManager {
  private baseUrl: string;

  constructor(baseUrl: string = "") {
    this.baseUrl = baseUrl;
  }

  // Documents APIs
  async insertFile(file: File): Promise<InsertResponse> {
    const formData = new FormData();
    formData.append("file", file);
    const response = await axios.post(
      `${this.baseUrl}/documents/file`,
      formData,
    );
    return response.data;
  }

  async insertBatchFiles(files: File[]): Promise<InsertResponse> {
    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));
    const response = await axios.post(
      `${this.baseUrl}/documents/file/batch`,
      formData,
    );
    return response.data;
  }

  async uploadToInputDir(file: File): Promise<InsertResponse> {
    const formData = new FormData();
    formData.append("file", file);
    const response = await axios.post(
      `${this.baseUrl}/documents/upload`,
      formData,
    );
    return response.data;
  }

  async getDocumentStatuses(): Promise<DocsStatusesResponse> {
    const response = await axios.get(`${this.baseUrl}/documents/status`);
    return response.data;
  }

  // Query APIs
  async query(queryRequest: QueryRequest): Promise<QueryResponse> {
    const response = await axios.post(`${this.baseUrl}/query`, queryRequest);
    return response.data;
  }

  async queryStream(queryRequest: QueryRequest): Promise<ReadableStream> {
    const response = await fetch(`${this.baseUrl}/query/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(queryRequest),
    });
    return response.body!;
  }

  // Graph APIs
  async getGraphLabels(): Promise<GraphLabel[]> {
    const response = await axios.get(`${this.baseUrl}/graph/label/list`);
    return response.data;
  }

  async getKnowledgeGraph(): Promise<KnowledgeGraph> {
    const response = await axios.get(`${this.baseUrl}/graphs`);
    return response.data;
  }

  // Ollama APIs
  async getOllamaVersion(): Promise<OllamaVersion> {
    const response = await axios.get(`${this.baseUrl}/api/version`);
    return response.data;
  }

  async getOllamaTags(): Promise<OllamaTag[]> {
    const response = await axios.get(`${this.baseUrl}/api/tags`);
    return response.data;
  }

  async generateText(request: OllamaGenerateRequest): Promise<ReadableStream> {
    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    });
    return response.body!;
  }

  async chat(request: OllamaChatRequest): Promise<ReadableStream> {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    });
    return response.body!;
  }

  // Default APIs
  async getAuthStatus(): Promise<AuthStatus> {
    const response = await axios.get(`${this.baseUrl}/auth-status`);
    return response.data;
  }

  async login(loginRequest: LoginRequest): Promise<{ access_token: string }> {
    const response = await axios.post(`${this.baseUrl}/login`, loginRequest);
    return response.data;
  }

  async getHealthStatus(): Promise<HealthStatus> {
    const response = await axios.get(`${this.baseUrl}/health`);
    return response.data;
  }
}
