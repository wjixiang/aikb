import { Provider } from '@nestjs/common';
import { S3Service } from '@aikb/s3-service';
import { createS3ServiceFromEnv } from '@aikb/s3-service';

export const S3ServiceProvider: Provider<S3Service> = {
  provide: 'S3_SERVICE',
  useFactory: () => {
    try {
      return createS3ServiceFromEnv();
    } catch (error) {
      console.error('Failed to initialize S3 service:', error);
      throw new Error(
        `S3 service initialization failed: ${error instanceof Error ? error.message : String(error)}. Please ensure required environment variables are set: OSS_ACCESS_KEY_ID, OSS_SECRET_ACCESS_KEY, PDF_OSS_BUCKET_NAME, OSS_REGION, S3_ENDPOINT`,
      );
    }
  },
};