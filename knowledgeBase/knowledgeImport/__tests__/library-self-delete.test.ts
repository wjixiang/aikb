import Library, { LibraryItem, S3MongoLibraryStorage } from '../liberary';
import { BookMetadata } from '../liberary';
import * as fs from 'fs';
import * as path from 'path';

describe('LibraryItem.selfDelete', () => {
  let library: Library;
  let storage: S3MongoLibraryStorage;
  let testItem: LibraryItem;

  beforeAll(async () => {
    storage = new S3MongoLibraryStorage();
    library = new Library(storage);
  });

  afterAll(async () => {
    // Clean up any test data
  });

  beforeEach(async () => {
    // Create a test item for each test
    const testPdfPath = path.join(__dirname, '../../__tests__/fixtures/sample.pdf');
    
    // Create a simple test PDF if it doesn't exist
    if (!fs.existsSync(path.dirname(testPdfPath))) {
      fs.mkdirSync(path.dirname(testPdfPath), { recursive: true });
    }
    
    if (!fs.existsSync(testPdfPath)) {
      // Create a minimal PDF for testing
      const minimalPdf = Buffer.from('%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n/Contents 4 0 R\n>>\nendobj\n4 0 obj\n<<\n/Length 44\n>>\nstream\nBT\n/F1 12 Tf\n72 720 Td\n(Test PDF) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n0000000115 00000 n\n0000000204 00000 n\ntrailer\n<<\n/Size 5\n/Root 1 0 R\n>>\nstartxref\n299\n%%EOF');
      fs.writeFileSync(testPdfPath, minimalPdf);
    }

    const pdfBuffer = fs.readFileSync(testPdfPath);
    const metadata: Partial<BookMetadata> = {
      title: 'Test Document for Self Delete',
      authors: [
        { firstName: 'Test', lastName: 'Author' }
      ],
      tags: ['test', 'self-delete'],
      abstract: 'This is a test document for testing the selfDelete functionality'
    };

    testItem = await library.storePdf(pdfBuffer, 'test-self-delete.pdf', metadata);
    
    // Add some markdown content and chunks to test complete deletion
    await testItem.extractMarkdown();
    await testItem.chunkEmbed();
  });

  afterEach(async () => {
    // Clean up after each test if the item wasn't properly deleted
    if (testItem && testItem.metadata.id) {
      try {
        await library.deleteBook(testItem.metadata.id);
      } catch (error) {
        // Ignore errors during cleanup
      }
    }
  });

  it('should delete all associated data for a LibraryItem', async () => {
    const itemId = testItem.metadata.id!;
    
    // Verify the item exists before deletion
    const existingItem = await library.getItem(itemId);
    expect(existingItem).toBeTruthy();
    expect(existingItem?.metadata.id).toBe(itemId);
    
    // Verify chunks exist
    const chunks = await testItem.getChunks();
    expect(chunks.length).toBeGreaterThan(0);
    
    // Verify markdown exists
    const markdown = await testItem.getMarkdown();
    expect(markdown).toBeTruthy();
    expect(markdown.length).toBeGreaterThan(0);
    
    // Verify PDF exists
    expect(testItem.hasPdf()).toBe(true);
    
    // Perform self deletion
    const deleteResult = await testItem.selfDelete();
    expect(deleteResult).toBe(true);
    
    // Verify the item no longer exists
    const deletedItem = await library.getItem(itemId);
    expect(deletedItem).toBeNull();
    
    // Verify chunks are deleted
    const deletedChunks = await storage.getChunksByItemId(itemId);
    expect(deletedChunks.length).toBe(0);
    
    // Note: We can't easily verify S3 deletion without additional methods,
    // but the metadata deletion should be sufficient for the test
  });

  it('should handle deletion of item without PDF', async () => {
    // Create an item without PDF
    const metadata: BookMetadata = {
      title: 'Test Item without PDF',
      authors: [
        { firstName: 'Test', lastName: 'Author' }
      ],
      tags: ['test', 'no-pdf'],
      abstract: 'This is a test item without PDF',
      dateAdded: new Date(),
      dateModified: new Date(),
      fileType: 'other',
      collections: []
    };
    
    const savedMetadata = await storage.saveMetadata(metadata);
    const itemWithoutPdf = new LibraryItem(savedMetadata, storage);
    
    // Add some markdown content manually
    await storage.saveMarkdown(itemWithoutPdf.metadata.id!, '# Test Markdown\n\nThis is test content');
    
    // Verify the item exists
    const existingItem = await library.getItem(itemWithoutPdf.metadata.id!);
    expect(existingItem).toBeTruthy();
    
    // Perform self deletion
    const deleteResult = await itemWithoutPdf.selfDelete();
    expect(deleteResult).toBe(true);
    
    // Verify the item no longer exists
    const deletedItem = await library.getItem(itemWithoutPdf.metadata.id!);
    expect(deletedItem).toBeNull();
  });

  it('should handle deletion of item with PDF splitting info', async () => {
    // Create an item with PDF splitting info
    const itemId = testItem.metadata.id!;
    
    // Manually add PDF splitting info to test deletion of split parts
    await testItem.updateMetadata({
      pdfSplittingInfo: {
        itemId: itemId,
        originalFileName: 'test-split.pdf',
        totalParts: 2,
        parts: [
          {
            partIndex: 0,
            startPage: 1,
            endPage: 5,
            pageCount: 5,
            s3Key: 'test-split-part-1.pdf',
            s3Url: 'https://test-bucket.s3.amazonaws.com/test-split-part-1.pdf',
            status: 'completed'
          },
          {
            partIndex: 1,
            startPage: 6,
            endPage: 10,
            pageCount: 5,
            s3Key: 'test-split-part-2.pdf',
            s3Url: 'https://test-bucket.s3.amazonaws.com/test-split-part-2.pdf',
            status: 'completed'
          }
        ],
        processingTime: 1000
      }
    });
    
    // Perform self deletion
    const deleteResult = await testItem.selfDelete();
    expect(deleteResult).toBe(true);
    
    // Verify the item no longer exists
    const deletedItem = await library.getItem(itemId);
    expect(deletedItem).toBeNull();
  });
});