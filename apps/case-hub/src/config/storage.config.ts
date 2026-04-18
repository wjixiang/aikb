import { registerAs } from '@nestjs/config';

export type StorageType = 'local' | 's3' | 'garage';

export interface StorageConfig {
  type: StorageType;
  basePath: string | undefined;
  bucket: string | undefined;
  endpoint: string | undefined;
  accessKey: string | undefined;
  secretKey: string | undefined;
  region: string | undefined;
}

export default registerAs('storage', (): StorageConfig => ({
  type: (process.env['STORAGE_TYPE'] as StorageType) || 'local',
  basePath: process.env['STORAGE_BASE_PATH'] || './uploads',
  bucket: process.env['STORAGE_BUCKET'],
  endpoint: process.env['STORAGE_ENDPOINT'],
  accessKey: process.env['STORAGE_ACCESS_KEY'],
  secretKey: process.env['STORAGE_SECRET_KEY'],
  region: process.env['STORAGE_REGION'],
}));
