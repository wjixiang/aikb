# @aikb/pdf-splitter

A TypeScript library for splitting PDF documents into smaller parts or chunks.

## Features

- Get PDF dimensions (width and height)
- Split PDF by page range
- Split PDF into chunks of specified size
- Built with pdf-lib for reliable PDF processing
- Comprehensive logging support

## Installation

```bash
pnpm add @aikb/pdf-splitter
```

## Usage

```typescript
import { PdfSpliterWorker } from '@aikb/pdf-splitter';

const splitter = new PdfSpliterWorker();

// Get PDF dimensions
const dimensions = await splitter.getPdfSize(pdfBuffer);
console.log(`Width: ${dimensions.width}, Height: ${dimensions.height}`);

// Split PDF by page range (pages 1-3, 0-indexed)
const splitPdf = await splitter.splitPdf(pdfBuffer, 1, 3);

// Split PDF into chunks of 10 pages each
const chunks = await splitter.splitPdfIntoChunks(pdfBuffer, 10);
```

## API

### PdfSpliterWorker

#### Methods

- `getPdfSize(existingPdfBytes: Buffer): Promise<{ height: number; width: number }>`
  - Gets the dimensions of the first page of the PDF
  
- `splitPdf(existingPdfBytes: Buffer, startPage: number, endPage: number): Promise<Uint8Array>`
  - Splits a PDF to include only pages from startPage to endPage (inclusive)
  - Pages are 0-indexed
  
- `splitPdfIntoChunks(existingPdfBytes: Buffer, chunkSize?: number): Promise<Uint8Array[]>`
  - Splits a PDF into multiple chunks of specified size
  - Default chunk size is 10 pages

## Dependencies

- `pdf-lib`: For PDF manipulation
- `@aikb/log-management`: For logging functionality

## Development

```bash
# Install dependencies
pnpm install

# Run tests
pnpm test

# Build
pnpm build