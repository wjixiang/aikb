/**
 * Basic Upload Example
 *
 * This example demonstrates how to use the S3Service to upload files
 * using both the new class-based API and legacy functions.
 */

import {
  S3Service,
  createAWSS3Service,
  createAliyunOSSService,
} from '../src/index';
import { uploadToS3 } from '../src/index'; // Legacy function

// Example 1: Using AWS S3
async function awsS3Example() {
  console.log('=== AWS S3 Example ===');

  const s3Service = createAWSS3Service(
    'your-aws-access-key-id',
    'your-aws-secret-access-key',
    'your-s3-bucket-name',
    'us-east-1',
  );

  try {
    const buffer = Buffer.from('Hello, AWS S3!');
    const result = await s3Service.uploadToS3(buffer, 'hello-aws.txt', {
      contentType: 'text/plain',
    });

    console.log('Upload successful!');
    console.log('URL:', result.url);
    console.log('Bucket:', result.bucket);
    console.log('Key:', result.key);
  } catch (error) {
    console.error('Upload failed:', error);
  }
}

// Example 2: Using Aliyun OSS
async function aliyunOSSExample() {
  console.log('\n=== Aliyun OSS Example ===');

  const ossService = createAliyunOSSService(
    'your-aliyun-access-key-id',
    'your-aliyun-secret-access-key',
    'your-oss-bucket-name',
    'oss-cn-hangzhou',
  );

  try {
    const buffer = Buffer.from('Hello, Aliyun OSS!');
    const result = await ossService.uploadToS3(buffer, 'hello-aliyun.txt', {
      contentType: 'text/plain',
    });

    console.log('Upload successful!');
    console.log('URL:', result.url);
    console.log('Bucket:', result.bucket);
    console.log('Key:', result.key);
  } catch (error) {
    console.error('Upload failed:', error);
  }
}

// Example 3: Using custom configuration
async function customConfigExample() {
  console.log('\n=== Custom Configuration Example ===');

  const customService = new S3Service({
    accessKeyId: 'your-access-key',
    secretAccessKey: 'your-secret-key',
    bucketName: 'your-bucket',
    region: 'custom-region',
    endpoint: 'custom-endpoint.com',
    forcePathStyle: true,
    signingRegion: 'custom-signing-region',
  });

  try {
    const buffer = Buffer.from('Hello, Custom S3!');
    const result = await customService.uploadToS3(buffer, 'hello-custom.txt', {
      contentType: 'text/plain',
    });

    console.log('Upload successful!');
    console.log('URL:', result.url);
    console.log('Bucket:', result.bucket);
    console.log('Key:', result.key);
  } catch (error) {
    console.error('Upload failed:', error);
  }
}

// Example 4: Using legacy function (backward compatibility)
async function legacyExample() {
  console.log('\n=== Legacy Function Example ===');

  // Note: This requires environment variables to be set
  // OSS_ACCESS_KEY_ID, OSS_SECRET_ACCESS_KEY, PDF_OSS_BUCKET_NAME, OSS_REGION, S3_ENDPOINT

  try {
    const buffer = Buffer.from('Hello, Legacy API!');
    const url = await uploadToS3(buffer, 'hello-legacy.txt', 'text/plain');

    console.log('Upload successful!');
    console.log('URL:', url);
  } catch (error) {
    console.error('Upload failed:', error);
    console.log('Note: Make sure environment variables are set for legacy API');
  }
}

// Example 5: Upload with different content types
async function differentContentTypesExample() {
  console.log('\n=== Different Content Types Example ===');

  const s3Service = createAWSS3Service(
    'your-aws-access-key-id',
    'your-aws-secret-access-key',
    'your-s3-bucket-name',
  );

  const examples = [
    {
      name: 'example.json',
      content: '{"message": "Hello, JSON!"}',
      type: 'application/json',
    },
    {
      name: 'example.html',
      content: '<h1>Hello, HTML!</h1>',
      type: 'text/html',
    },
    {
      name: 'example.xml',
      content: '<message>Hello, XML!</message>',
      type: 'application/xml',
    },
  ];

  for (const example of examples) {
    try {
      const buffer = Buffer.from(example.content);
      const result = await s3Service.uploadToS3(buffer, example.name, {
        contentType: example.type,
      });

      console.log(`Uploaded ${example.name}: ${result.url}`);
    } catch (error) {
      console.error(`Failed to upload ${example.name}:`, error);
    }
  }
}

// Run all examples
async function runExamples() {
  console.log('S3 Service Basic Upload Examples\n');

  // Uncomment the examples you want to run:
  // await awsS3Example();
  // await aliyunOSSExample();
  // await customConfigExample();
  // await legacyExample();
  // await differentContentTypesExample();

  console.log(
    '\nNote: Uncomment the examples above and update credentials to run them',
  );
}

// Run if this file is executed directly
if (require.main === module) {
  runExamples().catch(console.error);
}

export {
  awsS3Example,
  aliyunOSSExample,
  customConfigExample,
  legacyExample,
  differentContentTypesExample,
};
