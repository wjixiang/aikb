import { PdfSpliterWorker } from '../pdfSpliter';
import { PDFDocument } from 'pdf-lib';

describe('PdfSpliterWorker', () => {
  let pdfSpliter: PdfSpliterWorker;
  let testPdfBytes: Uint8Array;

  beforeAll(async () => {
    pdfSpliter = new PdfSpliterWorker();

    // Create a simple test PDF with 5 pages
    const pdfDoc = await PDFDocument.create();
    for (let i = 0; i < 5; i++) {
      const page = pdfDoc.addPage([600, 400]);
      // Add some content to each page
      page.drawText(`Test Page ${i + 1}`, {
        x: 50,
        y: 350,
        size: 20,
      });
    }
    testPdfBytes = await pdfDoc.save();
  });

  describe('getPdfSize', () => {
    it('should return the correct PDF dimensions', async () => {
      const buffer = Buffer.from(testPdfBytes);
      const result = await pdfSpliter.getPdfSize(buffer);

      expect(result.width).toBe(600);
      expect(result.height).toBe(400);
    });

    it('should handle empty PDF', async () => {
      // Create an empty PDF document with no pages
      const emptyPdfDoc = await PDFDocument.create();
      // Don't add any pages to create a truly empty PDF
      const emptyPdfBytes = await emptyPdfDoc.save();
      const buffer = Buffer.from(emptyPdfBytes);

      // The current implementation returns default dimensions for empty PDFs
      // This test verifies the current behavior
      const result = await pdfSpliter.getPdfSize(buffer);
      expect(result.width).toBe(595.28); // Default A4 width
      expect(result.height).toBe(841.89); // Default A4 height
    });
  });

  describe('splitPdf', () => {
    it('should split a PDF into a specific page range', async () => {
      const buffer = Buffer.from(testPdfBytes);
      const result = await pdfSpliter.splitPdf(buffer, 1, 3);

      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBeGreaterThan(0);

      // Verify the split PDF has the correct number of pages
      const splitPdfDoc = await PDFDocument.load(result);
      expect(splitPdfDoc.getPageCount()).toBe(3); // pages 1, 2, 3 (0-indexed)
    });

    it('should handle single page split', async () => {
      const buffer = Buffer.from(testPdfBytes);
      const result = await pdfSpliter.splitPdf(buffer, 2, 2);

      const splitPdfDoc = await PDFDocument.load(result);
      expect(splitPdfDoc.getPageCount()).toBe(1);
    });

    it('should handle invalid page ranges', async () => {
      const buffer = Buffer.from(testPdfBytes);

      await expect(pdfSpliter.splitPdf(buffer, -1, 2)).rejects.toThrow(
        'Invalid page range',
      );
      await expect(pdfSpliter.splitPdf(buffer, 0, 10)).rejects.toThrow(
        'Invalid page range',
      );
      await expect(pdfSpliter.splitPdf(buffer, 3, 2)).rejects.toThrow(
        'Invalid page range',
      );
    });
  });

  describe('splitPdfIntoChunks', () => {
    it('should split a PDF into chunks', async () => {
      const buffer = Buffer.from(testPdfBytes);
      const chunks = await pdfSpliter.splitPdfIntoChunks(buffer, 2);

      expect(chunks).toHaveLength(3); // 5 pages with chunk size 2 = 3 chunks
      expect(chunks[0]).toBeInstanceOf(Uint8Array);
      expect(chunks[1]).toBeInstanceOf(Uint8Array);
      expect(chunks[2]).toBeInstanceOf(Uint8Array);

      // Verify each chunk has the correct number of pages
      const chunk1Doc = await PDFDocument.load(chunks[0]);
      const chunk2Doc = await PDFDocument.load(chunks[1]);
      const chunk3Doc = await PDFDocument.load(chunks[2]);

      expect(chunk1Doc.getPageCount()).toBe(2); // pages 0, 1
      expect(chunk2Doc.getPageCount()).toBe(2); // pages 2, 3
      expect(chunk3Doc.getPageCount()).toBe(1); // page 4
    });

    it('should handle chunk size larger than total pages', async () => {
      const buffer = Buffer.from(testPdfBytes);
      const chunks = await pdfSpliter.splitPdfIntoChunks(buffer, 10);

      expect(chunks).toHaveLength(1);
      const chunkDoc = await PDFDocument.load(chunks[0]);
      expect(chunkDoc.getPageCount()).toBe(5);
    });
  });
});
