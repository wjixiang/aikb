import { describe, it, expect } from 'vitest'
import { FileType } from '../src/types'

describe('FileType', () => {
  it('should have correct enum values', () => {
    expect(FileType.PDF).toBe('pdf')
    expect(FileType.DOCX).toBe('docx')
    expect(FileType.PPTX).toBe('pptx')
    expect(FileType.XLSX).toBe('xlsx')
    expect(FileType.MARKDOWN).toBe('markdown')
    expect(FileType.TXT).toBe('txt')
    expect(FileType.HTML).toBe('html')
    expect(FileType.RTF).toBe('rtf')
    expect(FileType.UNKNOWN).toBe('unknown')
  })
})
