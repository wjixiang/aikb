/**
 * Abstract base class for PDF converters
 */
export abstract class AbstractPdfConvertor {
  abstract convertPdfToMarkdown(pdfPath: string);
}
