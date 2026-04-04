import { config } from '../config.js';
import { createStorageService } from './index.js';
import type { IStorageService } from './types.js';

let storageInstance: IStorageService | null = null;

export function getStorage(): IStorageService {
  if (storageInstance) {
    return storageInstance;
  }

  const { s3 } = config;
  if (!s3.accessKeyId || !s3.secretAccessKey || !s3.bucket) {
    throw new Error('S3 configuration is incomplete (missing accessKeyId, secretAccessKey, or bucket)');
  }

  storageInstance = createStorageService({
    endpoint: s3.endpoint,
    region: s3.region,
    bucket: s3.bucket,
    accessKeyId: s3.accessKeyId,
    secretAccessKey: s3.secretAccessKey,
    forcePathStyle: s3.forcePathStyle,
    publicUrl: s3.publicUrl,
  });

  return storageInstance;
}

export const storage = getStorage();
