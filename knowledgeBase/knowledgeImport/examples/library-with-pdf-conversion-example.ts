import Library from '../liberary';
import { S3MongoLibraryStorage } from '../liberary';
import { MinerUPdfConvertor } from '../MinerUPdfConvertor';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Example demonstrating the complete workflow of storing a PDF with automatic Markdown conversion
 */

async function demonstrateLibraryWithPdfConversion() {
  console.log('=== Library with PDF Conversion Example ===');

  try {
    // Initialize the storage
    const storage = new S3MongoLibraryStorage();

    // Initialize the PDF converter (make sure to set your MINERU_TOKEN in environment variables)
    const minerUToken = process.env.MINERU_TOKEN;
    if (!minerUToken) {
      console.error(
        'MINERU_TOKEN environment variable is required for PDF conversion',
      );
      return;
    }

    const pdfConvertor = new MinerUPdfConvertor({
      token: minerUToken,
      baseUrl: 'https://mineru.net/api/v4',
      timeout: 60000, // 60 seconds timeout
      maxRetries: 3,
      retryDelay: 2000,
    });

    // Initialize the Library with both storage and converter
    const library = new Library(storage, pdfConvertor);

    // Example PDF path (replace with an actual PDF file path)
    const pdfPath = path.join(__dirname, '../../test-data/sample.pdf');

    // Check if the PDF file exists
    if (!fs.existsSync(pdfPath)) {
      console.error(`PDF file not found at: ${pdfPath}`);
      console.log(
        'Please place a PDF file at the above path to test the conversion',
      );
      return;
    }

    // Prepare metadata for the PDF
    const metadata = {
      title: 'Sample PDF Document',
      authors: [{ firstName: 'John', lastName: 'Doe' }],
      abstract:
        'This is a sample PDF document for testing the conversion workflow',
      publicationYear: 2023,
      tags: ['sample', 'test', 'conversion'],
      collections: [],
    };

    console.log(`\n1. Storing PDF: ${pdfPath}`);
    console.log('   This will perform the following steps:');
    console.log('   - Upload to S3');
    console.log('   - Convert to Markdown using MinerU');
    console.log('   - Save the Markdown content');

    // Store the PDF with automatic conversion
    const libraryItem = await library.storePdf(pdfPath, metadata);

    console.log(
      `\n2. PDF stored successfully with ID: ${libraryItem.metadata.id}`,
    );
    console.log(`   Title: ${libraryItem.metadata.title}`);
    console.log(`   S3 URL: ${libraryItem.metadata.s3Url}`);
    console.log(`   File Size: ${libraryItem.metadata.fileSize} bytes`);

    // Get the Markdown content
    console.log('\n3. Retrieving Markdown content...');
    const markdownContent = await libraryItem.getMarkdown();

    if (markdownContent) {
      console.log('   Markdown content retrieved successfully!');
      console.log('   First 200 characters:');
      console.log('   ' + markdownContent.substring(0, 200) + '...');

      // Save the Markdown to a file for inspection
      const outputPath = path.join(
        __dirname,
        '../../test-output/sample-output.md',
      );
      fs.writeFileSync(outputPath, markdownContent);
      console.log(`   Full Markdown saved to: ${outputPath}`);
    } else {
      console.log('   No Markdown content available');
    }

    // Test searching for the item
    console.log('\n4. Testing search functionality...');
    const searchResults = await library.searchItems({
      query: 'sample',
    });

    console.log(`   Found ${searchResults.length} items matching "sample"`);

    console.log('\n=== Example completed successfully! ===');
  } catch (error) {
    console.error('Error in example:', error);
  }
}

// Run the example
if (require.main === module) {
  demonstrateLibraryWithPdfConversion();
}

export { demonstrateLibraryWithPdfConversion };
