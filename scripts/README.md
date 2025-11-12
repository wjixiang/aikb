# PDF Upload Script

This script provides a complete workflow for uploading PDF files to the bibliography system. It handles:

1. Getting a presigned S3 URL
2. Uploading the PDF to S3
3. Creating a library item
4. Adding the uploaded PDF as an archive to the item

## Prerequisites

- Node.js and TypeScript installed
- Access to the bibliography service API
- Proper environment variables configured

## Installation

The script uses the following dependencies that should already be available in the monorepo:

- `@aikb/s3-service` - For S3 operations
- `utils` - For S3 utilities
- `bibliography` - For hash utilities
- `pdf-lib` - For PDF page count extraction

## Usage

### Basic Usage

```bash
npx tsx upload-pdf.ts <path-to-pdf-file>
```

### With Metadata

```bash
npx tsx upload-pdf.ts ./document.pdf \
  --title "My Document" \
  --author "John Doe" \
  --year 2023 \
  --tags "research,science" \
  --abstract "This is a research paper about..."
```

### All Available Options

```bash
npx tsx upload-pdf.ts <pdf-path> [options]

Arguments:
  pdf-path              Path to the PDF file to upload

Options:
  --title <title>       Title of the document
  --author <name>       Author name (can be used multiple times)
  --abstract <text>     Abstract of the document
  --year <year>         Publication year
  --publisher <name>    Publisher name
  --isbn <isbn>         ISBN number
  --doi <doi>           DOI identifier
  --url <url>           URL of the document
  --tags <tags>         Comma-separated tags
  --notes <notes>       Notes about the document
  --collections <cols>  Comma-separated collections
  --language <lang>     Language code (default: en)
```

## Environment Variables

- `BIBLIOGRAPHY_SERVICE_URL` - URL of the bibliography service (default: http://localhost:3001)

## Examples

### Upload a simple PDF

```bash
npx tsx upload-pdf.ts ./papers/research-paper.pdf
```

### Upload with full metadata

```bash
npx tsx upload-pdf.ts ./papers/ai-research-2023.pdf \
  --title "Advances in Artificial Intelligence" \
  --author "Dr. Jane Smith" \
  --author "Prof. John Doe" \
  --year 2023 \
  --publisher "Academic Press" \
  --isbn "978-0123456789" \
  --doi "10.1000/182" \
  --tags "artificial-intelligence,machine-learning,research" \
  --abstract "This paper presents recent advances in AI research..." \
  --collections "AI-Research,2023-Papers" \
  --language "en"
```

## Workflow

The script performs the following steps:

1. **File Validation**: Checks if the PDF file exists and is readable
2. **Metadata Extraction**: Extracts file hash, size, and page count
3. **Get Upload URL**: Requests a presigned S3 URL from the bibliography service
4. **Upload to S3**: Uploads the PDF file using the presigned URL
5. **Create Library Item**: Creates a new library item with the provided metadata
6. **Add Archive**: Associates the uploaded PDF with the library item as an archive

## Error Handling

The script includes comprehensive error handling:

- File not found errors
- Network connectivity issues
- API response errors
- PDF parsing errors
- S3 upload failures
- Duplicate file detection (prevents uploading the same file twice to the same item)

All errors are logged with descriptive messages to help with troubleshooting.

**Note**: The system prevents duplicate archives with the same file hash from being added to the same library item. If you try to upload the same PDF file multiple times to the same item, you'll receive an error indicating the archive already exists.

## Output

On successful upload, the script outputs:

- Item ID of the created library item
- S3 key where the file was stored
- Confirmation of each step in the workflow

On failure, it provides detailed error information to help diagnose the issue.

## Integration

The script can be integrated into other workflows:

- As part of a CI/CD pipeline
- In batch processing scripts
- As a library function in other TypeScript applications

### Programmatic Usage

```typescript
import { uploadPdf, UploadConfig } from './upload-pdf';

const config: UploadConfig = {
  pdfPath: './document.pdf',
  title: 'My Document',
  authors: [{ name: 'John Doe' }],
  tags: ['research', 'science'],
};

const result = await uploadPdf(config);
if (result.success) {
  console.log('Upload successful:', result.itemId);
} else {
  console.error('Upload failed:', result.error);
}