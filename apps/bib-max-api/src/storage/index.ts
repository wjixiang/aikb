export type {
  IStorageService,
  S3StorageConfig,
  StorageUploadOptions,
  StorageUploadResult,
  PresignedUrlResult,
} from "./types.js";

export { S3StorageService } from "./s3-storage.js";

import type { S3StorageConfig, IStorageService } from "./types.js";
import { S3StorageService } from "./s3-storage.js";

export function createStorageService(config: S3StorageConfig): IStorageService {
  return new S3StorageService(config);
}
