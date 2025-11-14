import { uploadFile } from '../src/index';
import type { S3ServiceConfig } from '../src/types';

// Example 1: Using custom S3 configuration
async function uploadWithCustomConfig() {
  const s3Config: S3ServiceConfig = {
    accessKeyId: 'your-access-key-id',
    secretAccessKey: 'your-secret-access-key',
    bucketName: 'your-bucket-name',
    region: 'us-east-1',
    endpoint: 'amazonaws.com',
  };

  const fileBuffer = Buffer.from('Hello, World!', 'utf-8');
  
  try {
    const result = await uploadFile(
      s3Config,
      'uploads/hello.txt',
      fileBuffer,
      'text/plain',
      'private'
    );
    
    console.log('File uploaded successfully:', result);
    console.log('URL:', result.url);
  } catch (error) {
    console.error('Upload failed:', error);
  }
}

// Example 2: Minimal parameters with custom config
async function uploadMinimal() {
  const s3Config: S3ServiceConfig = {
    accessKeyId: 'your-access-key-id',
    secretAccessKey: 'your-secret-access-key',
    bucketName: 'your-bucket-name',
    region: 'us-east-1',
    endpoint: 'amazonaws.com',
  };

  const fileBuffer = Buffer.from('Hello, World!', 'utf-8');
  
  try {
    // Uses default content type (application/octet-stream) and ACL (private)
    const result = await uploadFile(
      s3Config,
      'uploads/hello.bin',
      fileBuffer
    );
    
    console.log('File uploaded successfully:', result);
    console.log('URL:', result.url);
  } catch (error) {
    console.error('Upload failed:', error);
  }
}

// Example 3: Error handling
async function uploadWithErrorHandling() {
  const s3Config: S3ServiceConfig = {
    accessKeyId: 'your-access-key-id',
    secretAccessKey: 'your-secret-access-key',
    bucketName: 'your-bucket-name',
    region: 'us-east-1',
    endpoint: 'amazonaws.com',
  };

  try {
    // This will throw an error because s3Config is null
    await uploadFile(
      null as any,
      'test.txt',
      Buffer.from('test')
    );
  } catch (error) {
    console.error('Expected error (missing s3Config):', error.message);
  }

  try {
    // This will throw an error because s3Key is empty
    await uploadFile(
      s3Config,
      '', // Empty key
      Buffer.from('test')
    );
  } catch (error) {
    console.error('Expected error (missing s3Key):', error.message);
  }

  try {
    // This will throw an error because buffer is empty
    await uploadFile(
      s3Config,
      'test.txt',
      Buffer.alloc(0) // Empty buffer
    );
  } catch (error) {
    console.error('Expected error (missing buffer):', error.message);
  }
}

// Example 4: Upload different file types
async function uploadDifferentFileTypes() {
  const s3Config: S3ServiceConfig = {
    accessKeyId: 'your-access-key-id',
    secretAccessKey: 'your-secret-access-key',
    bucketName: 'your-bucket-name',
    region: 'us-east-1',
    endpoint: 'amazonaws.com',
  };

  try {
    // Upload JSON file
    const jsonData = { name: 'test', value: 123 };
    const jsonBuffer = Buffer.from(JSON.stringify(jsonData), 'utf-8');
    const jsonResult = await uploadFile(
      s3Config,
      'data/test.json',
      jsonBuffer,
      'application/json'
    );
    console.log('JSON file uploaded:', jsonResult.url);

    // Upload image (simulated)
    const imageBuffer = Buffer.from('fake-image-data', 'utf-8');
    const imageResult = await uploadFile(
      s3Config,
      'images/test.jpg',
      imageBuffer,
      'image/jpeg'
    );
    console.log('Image file uploaded:', imageResult.url);

    // Upload PDF (simulated)
    const pdfBuffer = Buffer.from('fake-pdf-data', 'utf-8');
    const pdfResult = await uploadFile(
      s3Config,
      'documents/test.pdf',
      pdfBuffer,
      'application/pdf'
    );
    console.log('PDF file uploaded:', pdfResult.url);
  } catch (error) {
    console.error('Upload failed:', error);
  }
}

// Run examples
if (require.main === module) {
  console.log('Running uploadFile examples...\n');
  
  console.log('1. Upload with custom config:');
  uploadWithCustomConfig().then(() => {
    console.log('\n2. Upload with minimal parameters:');
    return uploadMinimal();
  }).then(() => {
    console.log('\n3. Error handling examples:');
    return uploadWithErrorHandling();
  }).then(() => {
    console.log('\n4. Upload different file types:');
    return uploadDifferentFileTypes();
  }).catch(console.error);
}

export {
  uploadWithCustomConfig,
  uploadMinimal,
  uploadWithErrorHandling,
  uploadDifferentFileTypes,
};