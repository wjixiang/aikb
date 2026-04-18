import type { Readable } from "node:stream";

// ============ 上传 ============

export interface StorageUploadOptions {
  /** 对象键，如 attachments/{itemId}/{uuid}.pdf */
  key: string;
  /** 文件内容 */
  body: Buffer | Readable;
  /** MIME 类型，如 application/pdf */
  contentType: string;
  /** 自定义元数据 */
  metadata?: Record<string, string>;
}

export interface StorageUploadResult {
  key: string;
  size: number;
  etag?: string;
}

// ============ 预签名 URL ============

export interface PresignedUrlResult {
  url: string;
  expiresAt: Date;
}

// ============ 存储配置 ============

export interface S3StorageConfig {
  /** 自定义端点（Garage / R2），留空则使用 AWS 默认 */
  endpoint?: string;
  /** S3 区域 */
  region: string;
  /** Bucket 名称 */
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** Garage 等自托管服务需要设为 true */
  forcePathStyle?: boolean;
  /** 可选的公开访问基础 URL（用于拼接公开链接） */
  publicUrl?: string;
}

// ============ 存储接口 ============

export interface IStorageService {
  /** 上传文件 */
  upload(options: StorageUploadOptions): Promise<StorageUploadResult>;

  /** 下载文件，返回可读流 */
  get(key: string): Promise<Readable>;

  /** 删除文件 */
  delete(key: string): Promise<void>;

  /** 检查文件是否存在 */
  exists(key: string): Promise<boolean>;

  /** 生成上传预签名 URL（客户端直传） */
  getPresignedUploadUrl(
    key: string,
    contentType: string,
    expiresIn?: number,
  ): Promise<PresignedUrlResult>;

  /** 生成下载预签名 URL（客户端直传） */
  getPresignedDownloadUrl(
    key: string,
    expiresIn?: number,
  ): Promise<PresignedUrlResult>;

  /** 拼接对象公开访问 URL，若未配置 publicUrl 则返回 null */
  getPublicUrl(key: string): string | null;
}
