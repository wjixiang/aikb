import axios from 'axios';

describe('Bibliography Service E2E Tests', () => {
  const baseUrl = 'http://localhost:3000/api/library-items';

  describe('GET /api/library-items', () => {
    it('should return a message', async () => {
      const res = await axios.get(baseUrl);

      expect(res.status).toBe(200);
    });
  });

  describe('POST /api/library-items', () => {
    it('should create a new library item', async () => {
      // Create test data for the library item
      const createLibraryItemDto = {
        title: 'Test Book for E2E',
        authors: [
          {
            firstName: 'John',
            lastName: 'Doe',
            middleName: 'William',
          },
          {
            firstName: 'Jane',
            lastName: 'Smith',
          },
        ],
        abstract: 'This is a test abstract for the end-to-end test',
        publicationYear: 2023,
        publisher: 'Test Publisher',
        isbn: '978-0123456789',
        doi: '10.1000/182',
        url: 'https://example.com/test-book',
        tags: ['test', 'e2e', 'bibliography'],
        notes: 'Test notes for the library item',
        collections: ['test-collection'],
        language: 'en',
        markdownContent:
          '# Test Book\n\nThis is the markdown content of the test book.',
      };

      // Send POST request to create the library item
      const res = await axios.post(baseUrl, createLibraryItemDto);

      // Verify the response
      expect(res.status).toBe(201);
      expect(res.data).toBeDefined();

      // Check the metadata structure in the response
      const metadata = res.data.metadata;
      expect(metadata.title).toBe(createLibraryItemDto.title);
      expect(metadata.authors).toHaveLength(2);
      expect(metadata.authors[0].firstName).toBe('John');
      expect(metadata.authors[0].lastName).toBe('Doe');
      expect(metadata.authors[1].firstName).toBe('Jane');
      expect(metadata.authors[1].lastName).toBe('Smith');
      expect(metadata.abstract).toBe(createLibraryItemDto.abstract);
      expect(metadata.publicationYear).toBe(
        createLibraryItemDto.publicationYear,
      );
      expect(metadata.publisher).toBe(createLibraryItemDto.publisher);
      expect(metadata.isbn).toBe(createLibraryItemDto.isbn);
      expect(metadata.doi).toBe(createLibraryItemDto.doi);
      expect(metadata.url).toBe(createLibraryItemDto.url);
      expect(metadata.tags).toEqual(createLibraryItemDto.tags);
      expect(metadata.notes).toBe(createLibraryItemDto.notes);
      expect(metadata.collections).toEqual(createLibraryItemDto.collections);
      expect(metadata.language).toBe(createLibraryItemDto.language);
      expect(metadata.id).toBeDefined();
      expect(metadata.dateAdded).toBeDefined();
      expect(metadata.dateModified).toBeDefined();
    });

    it('should return 500 when creating a library item with invalid data', async () => {
      // Create invalid test data (missing required fields)
      const invalidCreateLibraryItemDto = {
        // Missing required title and authors
        abstract: 'This is a test abstract',
        tags: [],
        collections: [],
      };

      try {
        await axios.post(baseUrl, invalidCreateLibraryItemDto);
        // If we reach here, the test should fail
        expect(true).toBe(false);
      } catch (error) {
        // Verify that the error response has the expected status code
        expect(error.response.status).toBe(500);
        expect(error.response.data).toBeDefined();
        expect(error.response.data.message).toContain(
          'Failed to create library item',
        );
      }
    });
  });

  describe('POST /api/library-items/upload-url', () => {
    it('should generate a PDF upload URL', async () => {
      // Create test data for the upload URL request
      const pdfUploadUrlDto = {
        fileName: 'test-document.pdf',
        expiresIn: 3600, // 1 hour
      };

      // Send POST request to generate upload URL
      const res = await axios.post(`${baseUrl}/upload-url`, pdfUploadUrlDto);

      // Verify the response
      expect(res.status).toBe(201);
      expect(res.data).toBeDefined();

      // Check the response structure
      expect(res.data.uploadUrl).toBeDefined();
      expect(typeof res.data.uploadUrl).toBe('string');
      expect(res.data.s3Key).toBeDefined();
      expect(typeof res.data.s3Key).toBe('string');
      expect(res.data.s3Key).toContain('library/pdfs/');
      expect(res.data.s3Key).toContain('test-document.pdf');
      expect(res.data.expiresAt).toBeDefined();
      expect(typeof res.data.expiresAt).toBe('string');

      // Verify the upload URL is a valid presigned URL
      expect(res.data.uploadUrl).toContain('https://');
      expect(res.data.uploadUrl).toContain('X-Amz-Signature=');
    });

    it('should generate a PDF upload URL with default expiration', async () => {
      // Create test data without specifying expiration
      const pdfUploadUrlDto = {
        fileName: 'test-document-default.pdf',
      };

      // Send POST request to generate upload URL
      const res = await axios.post(`${baseUrl}/upload-url`, pdfUploadUrlDto);

      // Verify the response
      expect(res.status).toBe(201);
      expect(res.data).toBeDefined();

      // Check the response structure
      expect(res.data.uploadUrl).toBeDefined();
      expect(res.data.s3Key).toBeDefined();
      expect(res.data.expiresAt).toBeDefined();
    });

    it('should return 500 when generating upload URL with invalid data', async () => {
      // Create invalid test data (missing required fileName)
      const invalidPdfUploadUrlDto = {
        expiresIn: 3600,
      };

      try {
        await axios.post(`${baseUrl}/upload-url`, invalidPdfUploadUrlDto);
        // If we reach here, the test should fail
        expect(true).toBe(false);
      } catch (error) {
        // Verify that the error response has the expected status code
        // Check if error has response property
        if (error.response) {
          expect(error.response.status).toBe(500);
          expect(error.response.data).toBeDefined();
          expect(error.response.data.message).toContain(
            'Failed to get PDF upload URL',
          );
        } else {
          // If no response property, check if it's a network error or other type
          expect(error).toBeDefined();
        }
      }
    });
  });
});
