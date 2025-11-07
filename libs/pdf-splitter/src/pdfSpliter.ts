import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { createLoggerWithPrefix } from '@aikb/log-management';

const logger = createLoggerWithPrefix('PdfSpliter');

export class PdfSpliter {
  async getPdfSize(
    existingPdfBytes: Buffer,
  ): Promise<{ height: number; width: number }> {
    // Convert Buffer to Uint8Array to ensure compatibility with pdf-lib
    const pdfBytes = new Uint8Array(existingPdfBytes);
    logger.info(`Loading PDF with byte length: ${pdfBytes.length}`);

    // Get the first page of the document
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();

    if (pages.length === 0) {
      throw new Error('PDF document has no pages');
    }

    const firstPage = pages[0];

    // Get the width and height of the first page
    if (firstPage) {
      const { width, height } = firstPage.getSize();
      logger.info(`PDF size: width=${width}, height=${height}`);

      return {
        height: height,
        width: width,
      };
    }

    return {
      height: 0,
      width: 0,
    };
  }

  async splitPdf(
    existingPdfBytes: Buffer,
    startPage: number,
    endPage: number,
  ): Promise<Uint8Array> {
    try {
      logger.info(
        `Starting PDF split: startPage=${startPage}, endPage=${endPage}`,
      );

      // Convert Buffer to Uint8Array to ensure compatibility with pdf-lib
      const pdfBytes = new Uint8Array(existingPdfBytes);
      const pdfDoc = await PDFDocument.load(pdfBytes);

      const totalPages = pdfDoc.getPageCount();
      logger.info(`Total pages in PDF: ${totalPages}`);

      if (startPage < 0 || endPage >= totalPages || startPage > endPage) {
        throw new Error(
          `Invalid page range: startPage=${startPage}, endPage=${endPage}, totalPages=${totalPages}`,
        );
      }

      // Create a new PDF document for the split portion
      const newPdfDoc = await PDFDocument.create();

      // Copy pages from the original document to the new one
      const pagesToCopy = endPage - startPage + 1;
      logger.info(
        `Copying pages: startPage=${startPage}, endPage=${endPage}, count=${pagesToCopy}`,
      );

      const copiedPages = await newPdfDoc.copyPages(
        pdfDoc,
        Array.from({ length: pagesToCopy }, (_, i) => startPage + i),
      );

      // Add the copied pages to the new document
      copiedPages.forEach((page, index) => {
        newPdfDoc.addPage(page);
        // logger.info(`Added page ${startPage + index} to new PDF`)
      });

      // Save the new PDF document as bytes
      const newPdfBytes = await newPdfDoc.save();
      logger.info(`Created new PDF with byte length: ${newPdfBytes.length}`);

      return newPdfBytes;
    } catch (error) {
      logger.error(`Error splitting PDF: ${error}`);
      throw error;
    }
  }

  async splitPdfIntoChunks(
    existingPdfBytes: Buffer,
    chunkSize: number = 10,
  ): Promise<Uint8Array[]> {
    try {
      logger.info(`Starting PDF chunking with chunk size: ${chunkSize}`);

      // Convert Buffer to Uint8Array to ensure compatibility with pdf-lib
      const pdfBytes = new Uint8Array(existingPdfBytes);
      const pdfDoc = await PDFDocument.load(pdfBytes);

      const totalPages = pdfDoc.getPageCount();
      logger.info(`Total pages in PDF: ${totalPages}`);

      const chunks: Uint8Array[] = [];
      const numChunks = Math.ceil(totalPages / chunkSize);

      for (let i = 0; i < numChunks; i++) {
        const startPage = i * chunkSize;
        const endPage = Math.min(startPage + chunkSize - 1, totalPages - 1);

        logger.info(
          `Creating chunk ${i + 1}/${numChunks}: pages ${startPage}-${endPage}`,
        );

        const chunkBytes = await this.splitPdf(
          existingPdfBytes,
          startPage,
          endPage,
        );
        chunks.push(chunkBytes);
      }

      logger.info(`Created ${chunks.length} PDF chunks`);
      return chunks;
    } catch (error) {
      logger.error(`Error chunking PDF: ${error}`);
      throw error;
    }
  }
}
