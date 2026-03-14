/**
 * File Renderer 核心实现
 */

import type {
  FileRendererOptions,
  RenderResult,
  FileType,
  CloudFileSource,
  LocalFileSource,
} from './types'
import { FileType as FileTypeEnum } from './types'

/**
 * 支持的文件类型列表
 */
export const supportedFileTypes = [
  FileTypeEnum.PDF,
  FileTypeEnum.DOCX,
  FileTypeEnum.PPTX,
  FileTypeEnum.XLSX,
  FileTypeEnum.MARKDOWN,
  FileTypeEnum.TXT,
  FileTypeEnum.HTML,
  FileTypeEnum.RTF,
]

/**
 * 根据文件扩展名检测文件类型
 */
export function detectFileType(filename: string): FileType {
  const ext = filename.toLowerCase().split('.').pop() || ''

  const extMap: Record<string, FileType> = {
    pdf: FileTypeEnum.PDF,
    docx: FileTypeEnum.DOCX,
    doc: FileTypeEnum.DOCX,
    pptx: FileTypeEnum.PPTX,
    ppt: FileTypeEnum.PPTX,
    xlsx: FileTypeEnum.XLSX,
    xls: FileTypeEnum.XLSX,
    md: FileTypeEnum.MARKDOWN,
    markdown: FileTypeEnum.MARKDOWN,
    txt: FileTypeEnum.TXT,
    html: FileTypeEnum.HTML,
    htm: FileTypeEnum.HTML,
    rtf: FileTypeEnum.RTF,
  }

  return extMap[ext] || FileTypeEnum.UNKNOWN
}

/**
 * 渲染文件为纯文本
 *
 * @param source - 文件源（云端或本地）
 * @param options - 渲染选项
 * @returns 渲染结果
 */
export async function renderFile(
  source: CloudFileSource | LocalFileSource,
  _options: FileRendererOptions = {}
): Promise<RenderResult> {
  const startTime = Date.now()

  // 检测文件类型
  const filename = 'url' in source ? source.url.split('/').pop() || 'unknown' : source.path.split('/').pop() || 'unknown'
  const fileType = detectFileType(filename)

  // TODO: 实现具体的文件渲染逻辑
  // 1. 根据 source 类型获取文件内容
  // 2. 根据 fileType 调用对应的解析器
  // 3. 返回纯文本内容

  const content = `[Rendered content for ${filename} (${fileType})]`

  return {
    content,
    fileType,
    filename,
    size: 0,
    duration: Date.now() - startTime,
  }
}
