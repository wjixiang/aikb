import Library, { S3ElasticSearchLibraryStorage } from './library';
import { S3MongoLibraryStorage } from './library';
import * as fs from 'fs';
import * as path from 'path';
import { describe, it, expect, beforeAll } from 'vitest';
import { MinerUPdfConvertor } from './MinerU/MinerUPdfConvertor';


// beforeAll(async () => {
//   // Use MongoDB storage instead of Elasticsearch for more reliable testing
//   console.log('Using MongoDB storage for integration tests');
//   storage = new S3MongoLibraryStorage();
// });

export async function UploadTestPdf() {
  const testMinerUPdfConvertor = new MinerUPdfConvertor({
    token: process.env.MINERU_TOKEN as string,
    downloadDir: 'test/download',
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
  const storage = new S3ElasticSearchLibraryStorage('http://elasticsearch:9200', 1024);
  const library = new Library(storage, testMinerUPdfConvertor);

  // Read the test PDF file
  const pdfPath = 'test/viral_pneumonia.pdf';
  const pdfBuffer = fs.readFileSync(pdfPath);

  // Prepare metadata for the PDF
  const metadata = {
    title: 'viral_pneumonia',
    authors: [{ firstName: 'Test', lastName: 'Author' }],
    abstract: 'This is a test document',
    publicationYear: 2023,
    tags: ['test', 'research'],
    language: 'English',
  };

  // Store the PDF from buffer
  const book = await library.storePdf(pdfBuffer, 'viral_pneumonia', metadata);
  return book;
}

describe(Library, async () => {
  // Store the PDF from buffer
  const book = await UploadTestPdf();
  it.skip("self delete", async()=>{
    const res = await book.selfDelete()
    expect(res).toBe(true)
  })

  it.skip('upload pdf buffer and retrieve s3 download url', async () => {
    // Verify the book was stored correctly
    expect(book).toBeDefined();
    expect(book.metadata.title).toBe('viral_pneumonia');
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
  }, 30000); // Increase timeout to 30 seconds for S3 operations

  it.skip('get current md', async () => {
    // Read markdown content from Library storage
    const mdContent = await book.getMarkdown();
    console.log(
      `md content read from Library (1000 length): ${JSON.stringify(mdContent.substring(0, 1000))}`,
    );
  });

  it.skip('re-extract markdown', async () => {
    console.log(`re-extract markdown`);
    await book.extractMarkdown();
    const mdContent2 = await book.getMarkdown();
    console.log(
      `re-extracted md content (100 str): ${JSON.stringify(mdContent2.substring(0, 100))}`,
    );
  },99999);


  it.skip("justify existance of embedding", async()=>{
    const ceRes = await book.chunkEmbed()
    const exist = await book.hasCompletedChunkEmbed()
    console.log(exist)
    expect(exist).toBe(true)
  })

  it('semantic search', async()=>{
    const searchRes = await book.searchInChunks("ACEI",2)
    console.log(searchRes)
  })
});
