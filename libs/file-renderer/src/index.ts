/**
 * File Renderer - 云端文件读取与纯文本渲染
 *
 * 支持多种文件类型的云端读取和纯文本转换，供 LLM 使用
 */

// Re-export types
export type { FileRendererOptions, RenderResult, FileType } from './types'

// Re-export core functions
export { renderFile, detectFileType, supportedFileTypes } from './renderer'

// Default configuration
export const DEFAULT_OPTIONS: {
  maxFileSize: number
  timeout: number
  enableCache?: boolean
  cacheDir?: string
} = {
  maxFileSize: 50 * 1024 * 1024, // 50MB
  timeout: 30000, // 30 seconds
}
