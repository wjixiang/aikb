import Library, { S3ElasticSearchLibraryStorage } from './liberary';
import { S3MongoLibraryStorage } from './liberary';
import * as fs from 'fs';
import * as path from 'path';
import { describe, it, expect, beforeAll } from 'vitest';
import { MinerUPdfConvertor } from './MinerUPdfConvertor';


let storage: S3MongoLibraryStorage;

beforeAll(async () => {
  // Use MongoDB storage instead of Elasticsearch for more reliable testing
  console.log('Using MongoDB storage for integration tests');
  storage = new S3MongoLibraryStorage();
});

export async function UploadTestPdf() {
  const testMinerUPdfConvertor = new MinerUPdfConvertor({
    token: process.env.MINERU_TOKEN as string,
    downloadDir: path.join('test'),
    defaultOptions: {
      is_ocr: true,
      enable_formula: true,
      enable_table: true,
      language: 'en',
      extra_formats: ['docx', 'html'],
    },
    timeout: 120000, // 2 minutes timeout
    maxRetries: 3,
    retryDelay: 5000,
  });
  const library = new Library(storage, testMinerUPdfConvertor);

  // Read the test PDF file
  const pdfPath = "test/ACEI.pdf";
  const pdfBuffer = fs.readFileSync(pdfPath);

  // Prepare metadata for the PDF
  const metadata = {
    title: 'ACEI',
    authors: [{ firstName: 'Test', lastName: 'Author' }],
    abstract: 'This is a test document',
    publicationYear: 2023,
    tags: ['test', 'research'],
    language: 'English',
  };

  // Store the PDF from buffer
  const book = await library.storePdf(
    pdfBuffer,
    metadata
  );
  return book;
}

describe(Library, () => {
  it('upload pdf buffer and retrieve s3 download url', async () => {
    // Store the PDF from buffer
    const book = await UploadTestPdf();

    // Verify the book was stored correctly
    expect(book).toBeDefined();
    expect(book.metadata.title).toBe('ACEI');
    expect(book.metadata.s3Key).toBeDefined();
    expect(book.metadata.s3Url).toBeDefined();

    // Retrieve the S3 download URL
    const downloadUrl = await book.getPdfDownloadUrl();

    // Verify the download URL is valid
    expect(downloadUrl).toBeDefined();
    expect(typeof downloadUrl).toBe('string');
    expect(downloadUrl).toContain(book.metadata.s3Key!);

    // Verify the URL matches the stored URL
    // expect(downloadUrl).toBe(book.metadata.s3Url);

    console.log('Test completed successfully!');
    console.log(`PDF uploaded with ID: ${book.metadata.id}`);
    console.log(`S3 Key: ${book.metadata.s3Key}`);
    console.log(`Download URL: ${downloadUrl}`);

    // Read markdown content from Library storage
    const mdContent = await book.getMarkdown()
    console.log(`md content read from Library (100 str): ${JSON.stringify(mdContent.substring(0,100))}`)

  }, 30000); // Increase timeout to 30 seconds for S3 operations
});
