import Library, { LibraryItem, S3MongoLibraryStorage } from '../liberary';
import { BookMetadata } from '../liberary';
import * as fs from 'fs';
import * as path from 'path';

describe('LibraryItem.selfDelete (Simple Test)', () => {
  let storage: S3MongoLibraryStorage;

  beforeAll(async () => {
    storage = new S3MongoLibraryStorage();
  });

  it('should delete all associated data for a LibraryItem with manually added content', async () => {
    // Create a test item with PDF
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
    const metadata: BookMetadata = {
      title: 'Test Document for Self Delete',
      authors: [
        { firstName: 'Test', lastName: 'Author' }
      ],
      tags: ['test', 'self-delete'],
      abstract: 'This is a test document for testing the selfDelete functionality',
      dateAdded: new Date(),
      dateModified: new Date(),
      fileType: 'pdf',
      collections: []
    };

    // Upload PDF and save metadata directly (bypassing the Library.storePdf method)
    const pdfInfo = await storage.uploadPdf(pdfBuffer, 'test-self-delete.pdf');
    const fullMetadata = {
      ...metadata,
      s3Key: pdfInfo.s3Key,
      s3Url: pdfInfo.url,
      fileSize: pdfBuffer.length,
      contentHash: 'test-hash'
    };
    
    const savedMetadata = await storage.saveMetadata(fullMetadata);
    const testItem = new LibraryItem(savedMetadata, storage);
    
    // Manually add markdown content
    await storage.saveMarkdown(testItem.metadata.id!, '# Test Document\n\nThis is test content for self-delete.\n\n## Section 1\n\nSome content here.\n\n## Section 2\n\nMore content here.');
    
    // Manually add chunks
    const chunks = [
      {
        id: 'chunk1',
        itemId: testItem.metadata.id!,
        title: 'Section 1',
        content: 'This is test content for self-delete.\n\n## Section 1\n\nSome content here.',
        index: 0,
        metadata: {
          chunkType: 'h1',
          wordCount: 15
        },
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'chunk2',
        itemId: testItem.metadata.id!,
        title: 'Section 2',
        content: '## Section 2\n\nMore content here.',
        index: 1,
        metadata: {
          chunkType: 'h1',
          wordCount: 6
        },
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];
    
    await storage.batchSaveChunks(chunks);
    
    // Verify the item exists before deletion
    const existingItem = await storage.getMetadata(testItem.metadata.id!);
    expect(existingItem).toBeTruthy();
    expect(existingItem?.id).toBe(testItem.metadata.id);
    
    // Verify chunks exist
    const existingChunks = await storage.getChunksByItemId(testItem.metadata.id!);
    expect(existingChunks.length).toBe(2);
    
    // Verify markdown exists
    const existingMarkdown = await storage.getMarkdown(testItem.metadata.id!);
    expect(existingMarkdown).toBeTruthy();
    expect(existingMarkdown!.length).toBeGreaterThan(0);
    
    // Verify PDF exists
    expect(testItem.hasPdf()).toBe(true);
    
    // Perform self deletion
    const deleteResult = await testItem.selfDelete();
    expect(deleteResult).toBe(true);
    
    // Verify the item no longer exists
    const deletedItem = await storage.getMetadata(testItem.metadata.id!);
    expect(deletedItem).toBeNull();
    
    // Verify chunks are deleted
    const deletedChunks = await storage.getChunksByItemId(testItem.metadata.id!);
    expect(deletedChunks.length).toBe(0);
    
    // Verify markdown is deleted
    const deletedMarkdown = await storage.getMarkdown(testItem.metadata.id!);
    expect(deletedMarkdown).toBeNull();
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
    
    // Add a chunk manually
    const chunk = {
      id: 'chunk-no-pdf',
      itemId: itemWithoutPdf.metadata.id!,
      title: 'Test Chunk',
      content: 'This is test content',
      index: 0,
      metadata: {
        chunkType: 'paragraph',
        wordCount: 4
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    await storage.saveChunk(chunk);
    
    // Verify the item exists
    const existingItem = await storage.getMetadata(itemWithoutPdf.metadata.id!);
    expect(existingItem).toBeTruthy();
    
    // Verify chunks exist
    const existingChunks = await storage.getChunksByItemId(itemWithoutPdf.metadata.id!);
    expect(existingChunks.length).toBe(1);
    
    // Perform self deletion
    const deleteResult = await itemWithoutPdf.selfDelete();
    expect(deleteResult).toBe(true);
    
    // Verify the item no longer exists
    const deletedItem = await storage.getMetadata(itemWithoutPdf.metadata.id!);
    expect(deletedItem).toBeNull();
    
    // Verify chunks are deleted
    const deletedChunks = await storage.getChunksByItemId(itemWithoutPdf.metadata.id!);
    expect(deletedChunks.length).toBe(0);
  });

  it('should handle deletion of item with PDF splitting info', async () => {
    // Create an item with PDF
    const testPdfPath = path.join(__dirname, '../../__tests__/fixtures/sample.pdf');
    
    if (!fs.existsSync(testPdfPath)) {
      const minimalPdf = Buffer.from('%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n/Contents 4 0 R\n>>\nendobj\n4 0 obj\n<<\n/Length 44\n>>\nstream\nBT\n/F1 12 Tf\n72 720 Td\n(Test PDF) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n0000000115 00000 n\n0000000204 00000 n\ntrailer\n<<\n/Size 5\n/Root 1 0 R\n>>\nstartxref\n299\n%%EOF');
      fs.writeFileSync(testPdfPath, minimalPdf);
    }

    const pdfBuffer = fs.readFileSync(testPdfPath);
    const metadata: BookMetadata = {
      title: 'Test Document with Splitting Info',
      authors: [
        { firstName: 'Test', lastName: 'Author' }
      ],
      tags: ['test', 'splitting'],
      abstract: 'This is a test document with PDF splitting info',
      dateAdded: new Date(),
      dateModified: new Date(),
      fileType: 'pdf',
      collections: []
    };

    // Upload PDF and save metadata directly
    const pdfInfo = await storage.uploadPdf(pdfBuffer, 'test-split.pdf');
    const fullMetadata = {
      ...metadata,
      s3Key: pdfInfo.s3Key,
      s3Url: pdfInfo.url,
      fileSize: pdfBuffer.length,
      contentHash: 'test-hash-split'
    };
    
    const savedMetadata = await storage.saveMetadata(fullMetadata);
    const testItem = new LibraryItem(savedMetadata, storage);
    
    // Manually add PDF splitting info
    await testItem.updateMetadata({
      pdfSplittingInfo: {
        itemId: testItem.metadata.id!,
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
    
    // Verify the item exists
    const existingItem = await storage.getMetadata(testItem.metadata.id!);
    expect(existingItem).toBeTruthy();
    expect(existingItem?.pdfSplittingInfo).toBeTruthy();
    
    // Perform self deletion
    const deleteResult = await testItem.selfDelete();
    expect(deleteResult).toBe(true);
    
    // Verify the item no longer exists
    const deletedItem = await storage.getMetadata(testItem.metadata.id!);
    expect(deletedItem).toBeNull();
  });
});