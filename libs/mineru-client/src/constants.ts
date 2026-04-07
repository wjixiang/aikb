import * as path from 'path';

import type { MinerUConfig } from './types';

export const MINERU_DEFAULT_CONFIG = {
  baseUrl: 'https://mineru.net/api/v4',
  agentBaseUrl: 'https://mineru.net/api/v1/agent',
  timeout: 30000,
  maxRetries: 3,
  retryDelay: 1000,
  downloadDir: './mineru-downloads',
  defaultOptions: {
    is_ocr: false,
    enable_formula: true,
    enable_table: true,
    language: 'ch' as const,
    model_version: 'pipeline' as const,
  },
} as const;

export type MinerUResolvedConfig = Required<MinerUConfig>;

export function resolveConfig(config: MinerUConfig): MinerUResolvedConfig {
  return {
    baseUrl: config.baseUrl || MINERU_DEFAULT_CONFIG.baseUrl,
    agentBaseUrl:
      config.agentBaseUrl || MINERU_DEFAULT_CONFIG.agentBaseUrl,
    timeout: config.timeout || MINERU_DEFAULT_CONFIG.timeout,
    maxRetries: config.maxRetries || MINERU_DEFAULT_CONFIG.maxRetries,
    retryDelay: config.retryDelay || MINERU_DEFAULT_CONFIG.retryDelay,
    downloadDir: config.downloadDir,
    defaultOptions:
      config.defaultOptions || MINERU_DEFAULT_CONFIG.defaultOptions,
    token: config.token || '',
  } as MinerUResolvedConfig;
}

const VALID_EXTENSIONS = new Set([
  '.pdf', '.doc', '.docx', '.ppt', '.pptx', '.png', '.jpg', '.jpeg',
]);

export function isValidFileFormat(fileName: string): boolean {
  return VALID_EXTENSIONS.has(path.extname(fileName).toLowerCase());
}

export function getSupportedLanguages(): string[] {
  return [
    'ch', 'en', 'japan', 'korean', 'fr', 'german', 'spanish', 'russian',
    'arabic', 'italian', 'portuguese', 'romanian', 'bulgarian', 'ukrainian',
    'belarusian', 'tamil', 'telugu', 'kannada', 'thai', 'vietnamese', 'devanagari',
  ];
}
