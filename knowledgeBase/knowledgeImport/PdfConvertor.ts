import { MinerUPdfConvertor } from './MinerU/MinerUPdfConvertor';
import type { IPdfConvertor } from './IPdfConvertor';

/**
 * Factory function to create a MinerU PDF converter
 * @param config MinerU configuration
 * @returns MinerUPdfConvertor instance
 */
export function createMinerUConvertor(config: {
  token: string;
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
  defaultOptions?: {
    is_ocr?: boolean;
    enable_formula?: boolean;
    enable_table?: boolean;
    language?: string;
  };
  downloadDir?: string;
}): MinerUPdfConvertor {
  return new MinerUPdfConvertor(config);
}

/**
 * Create a MinerU converter with environment variables
 * @param options Additional configuration options
 * @returns MinerUPdfConvertor instance
 */
export function createMinerUConvertorFromEnv(
  options: {
    downloadDir?: string;
    defaultOptions?: {
      is_ocr?: boolean;
      enable_formula?: boolean;
      enable_table?: boolean;
      language?: string;
    };
  } = {},
): MinerUPdfConvertor {
  const token = process.env.MINERU_TOKEN;
  if (!token) {
    throw new Error('MINERU_TOKEN environment variable is required');
  }

  return new MinerUPdfConvertor({
    token,
    baseUrl: process.env.MINERU_BASE_URL,
    timeout: process.env.MINERU_TIMEOUT
      ? parseInt(process.env.MINERU_TIMEOUT)
      : undefined,
    maxRetries: process.env.MINERU_MAX_RETRIES
      ? parseInt(process.env.MINERU_MAX_RETRIES)
      : undefined,
    retryDelay: process.env.MINERU_RETRY_DELAY
      ? parseInt(process.env.MINERU_RETRY_DELAY)
      : undefined,
    downloadDir: options.downloadDir || process.env.MINERU_DOWNLOAD_DIR,
    defaultOptions: options.defaultOptions,
  });
}

// Re-export MinerU classes for convenience
export { MinerUPdfConvertor } from './MinerU/MinerUPdfConvertor';

// Export PDF converter interface
export type { IPdfConvertor } from './IPdfConvertor';

// Export types from MinerUPdfConvertor
export type {
  ConversionResult,
  MinerUPdfConvertorConfig,
  ImageUploadResult,
} from './MinerU/MinerUPdfConvertor';
