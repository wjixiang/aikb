import { PdfSpliterWorker } from './src/index';
import { PDFDocument } from 'pdf-lib';

async function example() {
  const splitter = new PdfSpliterWorker();

  // Create a simple test PDF with 5 pages
  const pdfDoc = await PDFDocument.create();
  for (let i = 0; i < 5; i++) {
    const page = pdfDoc.addPage([600, 400]);
    page.drawText(`Test Page ${i + 1}`, {
      x: 50,
      y: 350,
      size: 20,
    });
  }
  const testPdfBytes = await pdfDoc.save();
  const buffer = Buffer.from(testPdfBytes);

  // Get PDF dimensions
  const dimensions = await splitter.getPdfSize(buffer);
  console.log(
    `PDF dimensions: width=${dimensions.width}, height=${dimensions.height}`,
  );

  // Split PDF by page range (pages 1-3, 0-indexed)
  const splitPdf = await splitter.splitPdf(buffer, 1, 3);
  console.log(`Split PDF size: ${splitPdf.length} bytes`);

  // Split PDF into chunks of 2 pages each
  const chunks = await splitter.splitPdfIntoChunks(buffer, 2);
  console.log(`Created ${chunks.length} chunks`);

  console.log('PDF splitter package is working correctly!');
}

example().catch(console.error);
