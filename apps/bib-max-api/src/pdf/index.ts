import type { IPdfExtractor } from './types.js';
import { PdfjsExtractor } from './pdfjs-extractor.js';

export type { IPdfExtractor, PdfExtractOptions } from './types.js';

export function createPdfExtractor(): IPdfExtractor {
  return new PdfjsExtractor();
}
