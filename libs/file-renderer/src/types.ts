/**
 * File Renderer 类型定义
 */

export enum FileType {
  PDF = 'pdf',
  DOCX = 'docx',
  PPTX = 'pptx',
  XLSX = 'xlsx',
  MARKDOWN = 'markdown',
  TXT = 'txt',
  HTML = 'html',
  RTF = 'rtf',
  UNKNOWN = 'unknown',
}

export interface FileRendererOptions {
  /** 最大文件大小（字节） */
  maxFileSize?: number
  /** 请求超时（毫秒） */
  timeout?: number
  /** 是否启用缓存 */
  enableCache?: boolean
  /** 缓存目录 */
  cacheDir?: string
}

export interface RenderResult {
  /** 渲染后的纯文本内容 */
  content: string
  /** 文件类型 */
  fileType: FileType
  /** 原始文件名 */
  filename: string
  /** 文件大小（字节） */
  size: number
  /** 页数或段落数等元信息 */
  metadata?: Record<string, unknown>
  /** 渲染耗时（毫秒） */
  duration: number
}

export interface CloudFileSource {
  /** 文件 URL（S3、GCS、Azure Blob 等） */
  url: string
  /** 认证 token */
  authToken?: string
  /** 请求头 */
  headers?: Record<string, string>
}

export interface LocalFileSource {
  /** 本地文件路径 */
  path: string
}
