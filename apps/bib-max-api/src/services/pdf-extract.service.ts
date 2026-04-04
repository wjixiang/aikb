import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

// Set up worker (lazy, module-level)
let workerInitialized = false;
function ensureWorker() {
  if (workerInitialized) return;
  // Use fake worker to avoid needing worker binary
  pdfjsLib.GlobalWorkerOptions.workerSrc = '';
  workerInitialized = true;
}

const MAX_PAGES = 5;

export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  ensureWorker();

  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
  const totalPages = doc.numPages;
  const pagesToExtract = Math.min(totalPages, MAX_PAGES);

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
