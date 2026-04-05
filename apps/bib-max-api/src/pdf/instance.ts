import type { IPdfExtractor } from './types.js';
import { createPdfExtractor } from './index.js';

let instance: IPdfExtractor | null = null;

export function getPdfExtractor(): IPdfExtractor {
  if (!instance) {
    instance = createPdfExtractor();
  }
  return instance;
}
