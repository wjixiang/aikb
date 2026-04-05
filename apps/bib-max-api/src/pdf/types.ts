export interface PdfExtractOptions {
  /** Maximum number of pages to extract (default: 5) */
  maxPages?: number;
}

export interface IPdfExtractor {
  extractText(buffer: Buffer, options?: PdfExtractOptions): Promise<string>;
}
