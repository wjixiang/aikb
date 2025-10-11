import Library, { S3MongoLibraryStorage } from '../knowledgeImport/library';
import { BookMetadata } from '../knowledgeImport/library';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Example demonstrating the selfDelete functionality of LibraryItem
 */
async function demonstrateSelfDelete() {
  console.log('=== LibraryItem Self-Delete Example ===\n');

  // Initialize library with MongoDB storage
  const storage = new S3MongoLibraryStorage();
  const library = new Library(storage);

  try {
    // Create a test PDF if it doesn't exist
    const testPdfPath = path.join(__dirname, '../knowledgeImport/__tests__/fixtures/sample.pdf');
    
    if (!fs.existsSync(path.dirname(testPdfPath))) {
      fs.mkdirSync(path.dirname(testPdfPath), { recursive: true });
    }
    
    if (!fs.existsSync(testPdfPath)) {
      // Create a minimal PDF for testing
      const minimalPdf = Buffer.from('%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n/Contents 4 0 R\n>>\nendobj\n4 0 obj\n<<\n/Length 44\n>>\nstream\nBT\n/F1 12 Tf\n72 720 Td\n(Example PDF) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n0000000115 00000 n\n0000000204 00000 n\ntrailer\n<<\n/Size 5\n/Root 1 0 R\n>>\nstartxref\n299\n%%EOF');
      fs.writeFileSync(testPdfPath, minimalPdf);
    }

    // Step 1: Store a PDF in the library
    console.log('1. Storing a PDF in the library...');
    const pdfBuffer = fs.readFileSync(testPdfPath);
    const metadata: Partial<BookMetadata> = {
      title: 'Example Document for Self-Delete',
      authors: [
        { firstName: 'John', lastName: 'Doe' }
      ],
      tags: ['example', 'self-delete'],
      abstract: 'This is an example document to demonstrate the selfDelete functionality'
    };

    const libraryItem = await library.storePdf(pdfBuffer, 'example-self-delete.pdf', metadata);
    console.log(`   ✓ Created item with ID: ${libraryItem.metadata.id}`);
    console.log(`   ✓ Title: ${libraryItem.metadata.title}`);
    console.log(`   ✓ Has PDF: ${libraryItem.hasPdf()}`);

    // Step 2: Extract markdown content
    console.log('\n2. Extracting markdown content...');
    try {
      await libraryItem.extractMarkdown();
      console.log('   ✓ Markdown extracted successfully');
    } catch (error) {
      console.log('   ⚠ Markdown extraction failed (this is normal in test environment)');
    }

    // Step 3: Process chunks and embeddings
    console.log('\n3. Processing chunks and embeddings...');
    try {
      // Add some markdown content manually for testing
      await storage.saveMarkdown(libraryItem.metadata.id!, '# Example Document\n\nThis is a test document for demonstrating the selfDelete functionality.\n\n## Section 1\n\nSome content here.\n\n## Section 2\n\nMore content here.');
      
      await libraryItem.chunkEmbed();
      console.log('   ✓ Chunks and embeddings created successfully');
    } catch (error) {
      console.log('   ⚠ Chunk processing failed (this is normal in test environment)');
    }

    // Step 4: Check what data exists before deletion
    console.log('\n4. Checking item data before deletion...');
    
    // Check chunks
    const chunks = await libraryItem.getChunks();
    console.log(`   ✓ Chunks: ${chunks.length}`);
    
    // Check markdown
    const markdown = await libraryItem.getMarkdown();
    console.log(`   ✓ Markdown content length: ${markdown.length} characters`);
    
    // Check citations
    const citations = await storage.getCitations(libraryItem.metadata.id!);
    console.log(`   ✓ Citations: ${citations.length}`);

    // Step 5: Perform self deletion
    console.log('\n5. Performing self deletion...');
    console.log('   This will delete:');
    console.log('   - All chunks and embeddings');
    console.log('   - All citations');
    console.log('   - Markdown content');
    console.log('   - PDF file from S3');
    console.log('   - PDF split parts (if any)');
    console.log('   - Metadata record');
    
    const deleteResult = await libraryItem.selfDelete();
    console.log(`   ${deleteResult ? '✓' : '✗'} Self deletion ${deleteResult ? 'successful' : 'failed'}`);

    // Step 6: Verify deletion
    console.log('\n6. Verifying deletion...');
    const deletedItem = await library.getItem(libraryItem.metadata.id!);
    
    if (deletedItem) {
      console.log('   ✗ Item still exists in the database');
    } else {
      console.log('   ✓ Item successfully removed from the database');
    }

    // Check if chunks are deleted
    const remainingChunks = await storage.getChunksByItemId(libraryItem.metadata.id!);
    console.log(`   ✓ Remaining chunks: ${remainingChunks.length}`);

    console.log('\n=== Self-Delete Example Complete ===');

  } catch (error) {
    console.error('Error during self-delete example:', error);
  }
}

// Run the example
if (require.main === module) {
  demonstrateSelfDelete().catch(console.error);
}

export { demonstrateSelfDelete };