export interface MinerUConfig {
  token?: string;
  baseUrl?: string;
  agentBaseUrl?: string;
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
  downloadDir: string;
  defaultOptions: {
    is_ocr: boolean;
    enable_formula: boolean;
    enable_table: boolean;
    language: 'en' | 'ch';
    model_version: 'pipeline' | 'vlm' | 'MinerU-HTML';
  };
}
