import { describe, it, expect } from 'vitest'
import { detectFileType, supportedFileTypes, renderFile } from '../src/renderer'
import { FileType } from '../src/types'

describe('detectFileType', () => {
  it('should detect PDF files', () => {
    expect(detectFileType('document.pdf')).toBe(FileType.PDF)
    expect(detectFileType('test.PDF')).toBe(FileType.PDF)
  })

  it('should detect DOCX files', () => {
    expect(detectFileType('document.docx')).toBe(FileType.DOCX)
    expect(detectFileType('document.doc')).toBe(FileType.DOCX)
  })

  it('should detect PPTX files', () => {
    expect(detectFileType('presentation.pptx')).toBe(FileType.PPTX)
    expect(detectFileType('presentation.ppt')).toBe(FileType.PPTX)
  })

  it('should detect XLSX files', () => {
    expect(detectFileType('spreadsheet.xlsx')).toBe(FileType.XLSX)
    expect(detectFileType('spreadsheet.xls')).toBe(FileType.XLSX)
  })

  it('should detect Markdown files', () => {
    expect(detectFileType('readme.md')).toBe(FileType.MARKDOWN)
    expect(detectFileType('readme.markdown')).toBe(FileType.MARKDOWN)
  })

  it('should detect TXT files', () => {
    expect(detectFileType('notes.txt')).toBe(FileType.TXT)
  })

  it('should detect HTML files', () => {
    expect(detectFileType('page.html')).toBe(FileType.HTML)
    expect(detectFileType('page.htm')).toBe(FileType.HTML)
  })

  it('should detect RTF files', () => {
    expect(detectFileType('document.rtf')).toBe(FileType.RTF)
  })

  it('should return UNKNOWN for unsupported extensions', () => {
    expect(detectFileType('file.xyz')).toBe(FileType.UNKNOWN)
    expect(detectFileType('noextension')).toBe(FileType.UNKNOWN)
  })
})

describe('supportedFileTypes', () => {
  it('should include all supported file types', () => {
    expect(supportedFileTypes).toContain(FileType.PDF)
    expect(supportedFileTypes).toContain(FileType.DOCX)
    expect(supportedFileTypes).toContain(FileType.PPTX)
    expect(supportedFileTypes).toContain(FileType.XLSX)
    expect(supportedFileTypes).toContain(FileType.MARKDOWN)
    expect(supportedFileTypes).toContain(FileType.TXT)
    expect(supportedFileTypes).toContain(FileType.HTML)
    expect(supportedFileTypes).toContain(FileType.RTF)
  })
})

describe('renderFile', () => {
  it('should render a cloud file', async () => {
    const result = await renderFile({
      url: 'https://example.com/document.pdf',
    })

    expect(result.filename).toBe('document.pdf')
    expect(result.fileType).toBe(FileType.PDF)
    expect(result.content).toContain('Rendered content')
  })

  it('should render a local file', async () => {
    const result = await renderFile({
      path: '/path/to/document.pdf',
    })

    expect(result.filename).toBe('document.pdf')
    expect(result.fileType).toBe(FileType.PDF)
  })

  it('should include duration in result', async () => {
    const result = await renderFile({
      path: '/path/to/document.pdf',
    })

    expect(result.duration).toBeGreaterThanOrEqual(0)
  })
})
