import Library from '../liberary';
import { S3MongoLibraryStorage } from '../liberary';
import { MinerUPdfConvertor } from '../MinerUPdfConvertor';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Simple test script to verify the library PDF conversion workflow
 * This is a basic integration test that can be run manually
 */

async function testLibraryPdfConversion() {
  console.log('=== Testing Library PDF Conversion Workflow ===');

  try {
    // Create a mock storage for testing
    const mockStorage = {
      uploadPdfFromPath: async (pdfPath: string) => {
        console.log(`Mock: Uploading PDF from path: ${pdfPath}`);
        return {
          id: 'pdf-123',
          name: path.basename(pdfPath),
          s3Key: `library/pdfs/2023/${Date.now()}-${path.basename(pdfPath)}`,
          url: `https://mock-s3-url.com/${path.basename(pdfPath)}`,
          fileSize: 1024,
          createDate: new Date(),
        };
      },
      saveMetadata: async (metadata: any) => {
        console.log(`Mock: Saving metadata for: ${metadata.title}`);
        return metadata;
      },
      getMetadataByHash: async (hash: string) => {
        console.log(`Mock: Checking for existing item with hash: ${hash}`);
        return null; // No duplicate found
      },
      saveMarkdown: async (itemId: string, markdownContent: string) => {
        console.log(`Mock: Saving markdown for item: ${itemId}`);
        console.log(`Markdown length: ${markdownContent.length} characters`);
      },
      getMarkdown: async (itemId: string) => {
        console.log(`Mock: Getting markdown for item: ${itemId}`);
        return '# Mock Markdown Content\n\nThis is test content.';
      },
      // Add other required methods with mock implementations
      uploadPdf: async (pdfData: Buffer, fileName: string) => {
        return {
          id: 'pdf-456',
          name: fileName,
          s3Key: `library/pdfs/2023/${Date.now()}-${fileName}`,
          url: `https://mock-s3-url.com/${fileName}`,
          fileSize: pdfData.length,
          createDate: new Date(),
        };
      },
      getPdfDownloadUrl: async (s3Key: string) => {
        return `https://mock-s3-url.com/${s3Key}`;
      },
      getPdf: async (s3Key: string) => {
        return Buffer.from('mock PDF content');
      },
      getMetadata: async (id: string) => {
        return null;
      },
      updateMetadata: async (metadata: any) => {
        console.log(`Mock: Updating metadata for: ${metadata.id}`);
      },
      searchMetadata: async (filter: any) => {
        return [];
      },
      saveCollection: async (collection: any) => {
        return collection;
      },
      getCollections: async () => {
        return [];
      },
      addItemToCollection: async (itemId: string, collectionId: string) => {
        console.log(
          `Mock: Adding item ${itemId} to collection ${collectionId}`,
        );
      },
      removeItemFromCollection: async (
        itemId: string,
        collectionId: string,
      ) => {
        console.log(
          `Mock: Removing item ${itemId} from collection ${collectionId}`,
        );
      },
      saveCitation: async (citation: any) => {
        return citation;
      },
      getCitations: async (itemId: string) => {
        return [];
      },
    };

    // Create a mock PDF converter for testing
    const mockPdfConvertor = {
      convertPdfToMarkdown: async (pdfPath: string) => {
        console.log(`Mock: Converting PDF to Markdown: ${pdfPath}`);
        return {
          success: true,
          data: '# Mock Converted Document\n\nThis is the mock converted markdown content from the PDF.\n\n## Section 1\n\nSome content here.\n\n## Section 2\n\nMore content here.',
          taskId: 'mock-task-123',
        };
      },
    };

    // Create the library instance with mock components
    const library = new Library(mockStorage as any, mockPdfConvertor as any);

    // Test data
    const testPdfPath = '/mock/path/to/test.pdf';
    const testMetadata = {
      title: 'Test PDF Document',
      authors: [{ firstName: 'John', lastName: 'Doe' }],
      abstract:
        'This is a test PDF document for testing the conversion workflow',
      publicationYear: 2023,
      tags: ['test', 'conversion', 'mock'],
      collections: [],
    };

    console.log('\n1. Testing storePdf with conversion...');

    // Test the storePdf method
    const libraryItem = await library.storePdf(testPdfPath, testMetadata);

    console.log('\n2. Verifying results...');
    console.log(`   Item ID: ${libraryItem.metadata.id}`);
    console.log(`   Title: ${libraryItem.metadata.title}`);
    console.log(`   S3 URL: ${libraryItem.metadata.s3Url}`);
    console.log(`   Has Markdown: ${!!libraryItem.metadata.markdownContent}`);

    // Test getting the markdown content
    console.log('\n3. Testing getMarkdown...');
    const markdownContent = await libraryItem.getMarkdown();
    console.log(`   Markdown retrieved: ${markdownContent ? 'Yes' : 'No'}`);
    console.log(`   Content preview: ${markdownContent?.substring(0, 100)}...`);

    console.log('\n=== Test completed successfully! ===');
    console.log(
      '\nThe library PDF conversion workflow is working as expected.',
    );
    console.log('The following steps were performed:');
    console.log('1. PDF upload to S3 (mocked)');
    console.log('2. PDF to Markdown conversion (mocked)');
    console.log('3. Markdown content storage (mocked)');
    console.log('4. Markdown content retrieval');
  } catch (error) {
    console.error('Test failed with error:', error);
  }
}

// Run the test
testLibraryPdfConversion();
