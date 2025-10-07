import Library from "./liberary";
import { S3MongoLibraryStorage } from "./liberary";
import * as fs from 'fs';
import * as path from 'path';

describe(Library, () => {
    it("upload pdf buffer and retrieve s3 download url", async () => {
        // Initialize the library with S3 and MongoDB storage
        const storage = new S3MongoLibraryStorage();
        const library = new Library(storage);

        // Read the test PDF file
        const pdfPath = path.join(__dirname, '__tests__', 'viral_pneumonia copy.pdf');
        const pdfBuffer = fs.readFileSync(pdfPath);
        
        // Prepare metadata for the PDF
        const metadata = {
            title: 'Viral Pneumonia Test Document',
            authors: [
                { firstName: 'Test', lastName: 'Author' }
            ],
            abstract: 'This is a test document for viral pneumonia research',
            publicationYear: 2023,
            tags: ['viral pneumonia', 'test', 'research'],
            language: 'English'
        };

        // Store the PDF from buffer
        const book = await library.storePdfFromBuffer(pdfBuffer, 'test-viral-pneumonia.pdf', metadata);
        
        // Verify the book was stored correctly
        expect(book).toBeDefined();
        expect(book.metadata.title).toBe('Viral Pneumonia Test Document');
        expect(book.metadata.s3Key).toBeDefined();
        expect(book.metadata.s3Url).toBeDefined();
        expect(book.metadata.fileSize).toBe(pdfBuffer.length);
        expect(book.metadata.fileType).toBe('pdf');

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
})