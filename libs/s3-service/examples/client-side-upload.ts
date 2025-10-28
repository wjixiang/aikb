/**
 * Client-side Upload Example
 *
 * This example demonstrates how to generate signed URLs for client-side uploads
 * and how to handle various error scenarios.
 */

import {
  S3Service,
  createS3ServiceFromEnv,
  S3ServiceError,
  S3ServiceErrorType,
} from '../src/index';

// Example 1: Generate signed URL for client-side upload
async function generateSignedUrlExample() {
  console.log('=== Generate Signed URL Example ===');

  const s3Service = createS3ServiceFromEnv();

  try {
    const fileName = 'client-uploads/document.pdf';
    const contentType = 'application/pdf';
    const expiresIn = 3600; // 1 hour

    const signedUrl = await s3Service.getSignedUploadUrl(fileName, {
      contentType,
      expiresIn,
    });

    console.log('Signed URL generated successfully!');
    console.log('URL:', signedUrl);
    console.log('Expires in:', expiresIn, 'seconds');

    // This URL can now be used by client applications to upload directly to S3
    console.log('\nClient-side upload example:');
    console.log('fetch(signedUrl, {');
    console.log('  method: "PUT",');
    console.log('  headers: { "Content-Type": "application/pdf" },');
    console.log('  body: file // File object from file input');
    console.log('})');
  } catch (error) {
    console.error('Failed to generate signed URL:', error);
  }
}

// Example 2: Generate multiple signed URLs for batch uploads
async function batchSignedUrlsExample() {
  console.log('\n=== Batch Signed URLs Example ===');

  const s3Service = createS3ServiceFromEnv();

  try {
    const files = [
      { name: 'documents/contract.pdf', type: 'application/pdf' },
      { name: 'images/photo.jpg', type: 'image/jpeg' },
      {
        name: 'documents/report.docx',
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      },
      { name: 'data/export.csv', type: 'text/csv' },
    ];

    const signedUrls: Array<{
      fileName: string;
      contentType: string;
      signedUrl: string;
    }> = [];

    for (const file of files) {
      try {
        const signedUrl = await s3Service.getSignedUploadUrl(file.name, {
          contentType: file.type,
          expiresIn: 1800, // 30 minutes
        });

        signedUrls.push({
          fileName: file.name,
          contentType: file.type,
          signedUrl,
        });

        console.log(`✓ Generated signed URL for ${file.name}`);
      } catch (error) {
        console.error(
          `✗ Failed to generate signed URL for ${file.name}:`,
          error,
        );
      }
    }

    console.log('\nGenerated signed URLs:');
    signedUrls.forEach((item) => {
      console.log(`${item.fileName}: ${item.signedUrl.substring(0, 100)}...`);
    });

    return signedUrls;
  } catch (error) {
    console.error('Batch signed URL generation failed:', error);
    return [];
  }
}

// Example 3: Generate signed URLs with different expiration times
async function variableExpirationExample() {
  console.log('\n=== Variable Expiration Times Example ===');

  const s3Service = createS3ServiceFromEnv();

  try {
    const scenarios = [
      { name: 'temp-upload.txt', type: 'text/plain', expiresIn: 300 }, // 5 minutes
      { name: 'session-upload.pdf', type: 'application/pdf', expiresIn: 1800 }, // 30 minutes
      { name: 'daily-upload.jpg', type: 'image/jpeg', expiresIn: 86400 }, // 24 hours
      { name: 'weekly-upload.csv', type: 'text/csv', expiresIn: 604800 }, // 1 week
    ];

    for (const scenario of scenarios) {
      const signedUrl = await s3Service.getSignedUploadUrl(scenario.name, {
        contentType: scenario.type,
        expiresIn: scenario.expiresIn,
      });

      const hours = Math.floor(scenario.expiresIn / 3600);
      const minutes = Math.floor((scenario.expiresIn % 3600) / 60);

      console.log(
        `${scenario.name}: ${hours}h ${minutes}m - ${signedUrl.substring(0, 80)}...`,
      );
    }
  } catch (error) {
    console.error('Variable expiration example failed:', error);
  }
}

// Example 4: Complete client upload workflow simulation
async function clientUploadWorkflowExample() {
  console.log('\n=== Client Upload Workflow Example ===');

  const s3Service = createS3ServiceFromEnv();

  try {
    // Step 1: Client requests signed URL from server
    console.log('Step 1: Client requesting signed URL...');
    const fileName = `uploads/${Date.now()}-document.pdf`;
    const signedUrl = await s3Service.getSignedUploadUrl(fileName, {
      contentType: 'application/pdf',
      expiresIn: 3600,
    });
    console.log('✓ Signed URL generated');

    // Step 2: Simulate client upload (in real scenario, this would be done in browser)
    console.log('Step 2: Simulating client upload...');
    await simulateClientUpload(signedUrl);
    console.log('✓ Client upload completed');

    // Step 3: Generate download URL for the uploaded file
    console.log('Step 3: Generating download URL...');
    const downloadUrl = await s3Service.getSignedDownloadUrl(fileName, {
      expiresIn: 7200, // 2 hours
    });
    console.log('✓ Download URL generated');
    console.log('Download URL:', downloadUrl);

    console.log('Workflow completed successfully!');
  } catch (error) {
    console.error('Client upload workflow failed:', error);
  }
}

// Helper function to simulate client upload
async function simulateClientUpload(signedUrl: string) {
  // In a real browser scenario, this would be:
  // fetch(signedUrl, {
  //   method: 'PUT',
  //   headers: { 'Content-Type': 'application/pdf' },
  //   body: file // File object from file input
  // });

  // For this example, we'll just simulate the delay
  await new Promise((resolve) => setTimeout(resolve, 1000));
}

// Example 5: Error handling for signed URL generation
async function errorHandlingExample() {
  console.log('\n=== Error Handling Example ===');

  // Test with invalid configuration
  try {
    const invalidService = new S3Service({
      accessKeyId: 'invalid-key',
      secretAccessKey: 'invalid-secret',
      bucketName: 'invalid-bucket',
      region: 'invalid-region',
      endpoint: 'invalid-endpoint.com',
    });

    await invalidService.getSignedUploadUrl('test.txt', {
      contentType: 'text/plain',
    });
  } catch (error) {
    if (error instanceof S3ServiceError) {
      console.log('Caught S3ServiceError:');
      console.log('Type:', error.type);
      console.log('Message:', error.message);

      switch (error.type) {
        case S3ServiceErrorType.SIGNED_URL_ERROR:
          console.log('This is a signed URL generation error');
          break;
        case S3ServiceErrorType.CONFIGURATION_ERROR:
          console.log('This is a configuration error');
          break;
        default:
          console.log('This is another type of error');
      }
    } else {
      console.log('Caught non-S3ServiceError:', error);
    }
  }
}

// Example 6: Secure signed URL generation
async function secureSignedUrlExample() {
  console.log('\n=== Secure Signed URL Example ===');

  const s3Service = createS3ServiceFromEnv();

  try {
    // Generate signed URL with user-specific path
    const userId = 'user123';
    const sessionId = 'session456';
    const fileName = 'document.pdf';

    const secureKey = `users/${userId}/sessions/${sessionId}/${Date.now()}-${fileName}`;

    const signedUrl = await s3Service.getSignedUploadUrl(secureKey, {
      contentType: 'application/pdf',
      expiresIn: 900, // 15 minutes for security
    });

    console.log('Secure signed URL generated:');
    console.log('Key:', secureKey);
    console.log('URL:', signedUrl.substring(0, 100) + '...');

    // Generate download URL with same security
    const downloadUrl = await s3Service.getSignedDownloadUrl(secureKey, {
      expiresIn: 1800, // 30 minutes
    });

    console.log('Secure download URL generated');
  } catch (error) {
    console.error('Secure signed URL generation failed:', error);
  }
}

// Run all examples
async function runExamples() {
  console.log('S3 Service Client-side Upload Examples\n');

  // Uncomment examples you want to run:
  // await generateSignedUrlExample();
  // await batchSignedUrlsExample();
  // await variableExpirationExample();
  // await clientUploadWorkflowExample();
  // await errorHandlingExample();
  // await secureSignedUrlExample();

  console.log('\nNote: Uncomment examples above to run them');
}

// Run if this file is executed directly
if (require.main === module) {
  runExamples().catch(console.error);
}

export {
  generateSignedUrlExample,
  batchSignedUrlsExample,
  variableExpirationExample,
  clientUploadWorkflowExample,
  errorHandlingExample,
  secureSignedUrlExample,
};
