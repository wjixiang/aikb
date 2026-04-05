import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { IPdfExtractor, PdfExtractOptions } from './types.js';

let workerInitialized = false;

function ensureWorker() {
  if (workerInitialized) return;
  pdfjsLib.GlobalWorkerOptions.workerSrc = import.meta.resolve(
    'pdfjs-dist/legacy/build/pdf.worker.mjs',
  );
  workerInitialized = true;
}

export class PdfjsExtractor implements IPdfExtractor {
  async extractText(buffer: Buffer, options?: PdfExtractOptions): Promise<string> {
    ensureWorker();

    const maxPages = options?.maxPages ?? 5;
    const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
    const totalPages = doc.numPages;
    const pagesToExtract = Math.min(totalPages, maxPages);

    const pageTexts: string[] = [];
    for (let i = 1; i <= pagesToExtract; i++) {
      const page = await doc.getPage(i);
      const textContent = await page.getTextContent();
      const text = textContent.items
        .filter((item) => 'str' in item)
        .map((item) => (item as { str: string }).str)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (text) pageTexts.push(text);
    }

    return pageTexts.join('\n\n');
  }
}
