import type {
  IAttachmentRepository,
  IStorageService,
  AttachmentRecord,
  PresignedUploadResult,
  FormattedAttachment,
  AttachmentCategory,
} from './types.js';
import { categorizeByMimeType } from './schemas.js';

// ============ Helpers ============

function buildS3Key(
  keyPrefix: string,
  itemId: string,
  attachmentId: string,
  fileName: string,
): string {
  const ext = fileName.split('.').pop() || '';
  return `${keyPrefix}/${itemId}/${attachmentId}.${ext}`;
}

function formatAttachment(
  attachment: AttachmentRecord,
): FormattedAttachment {
  return {
    id: attachment.id,
    itemId: attachment.itemId,
    fileName: attachment.fileName,
    fileType: attachment.fileType,
    fileSize:
      attachment.fileSize != null ? Number(attachment.fileSize) : null,
    category: categorizeByMimeType(attachment.fileType) as AttachmentCategory,
    createdAt: attachment.createdAt,
  };
}

// ============ Service ============

export class AttachmentService {
  constructor(
    private readonly repository: IAttachmentRepository,
    private readonly storage: IStorageService,
    private readonly options: {
      keyPrefix: string;
      presignTtl: number;
      notFoundError: (entity: string, id: string) => Error;
    },
  ) {}

  async generateUploadUrl(
    itemId: string,
    fileName: string,
    contentType: string,
  ): Promise<PresignedUploadResult> {
    const attachmentId = crypto.randomUUID();
    const s3Key = buildS3Key(
      this.options.keyPrefix,
      itemId,
      attachmentId,
      fileName,
    );
    const presigned = await this.storage.getPresignedUploadUrl(
      s3Key,
      contentType,
      this.options.presignTtl,
    );

    return {
      attachmentId,
      url: presigned.url,
      expiresAt: presigned.expiresAt,
    };
  }

  async confirmUpload(
    itemId: string,
    attachmentId: string,
    fileName: string,
    contentType: string,
    fileSize?: number,
  ): Promise<FormattedAttachment> {
    const s3Key = buildS3Key(
      this.options.keyPrefix,
      itemId,
      attachmentId,
      fileName,
    );
    const exists = await this.storage.exists(s3Key);
    if (!exists) {
      throw this.options.notFoundError('File', s3Key);
    }

    const attachment = await this.repository.create({
      itemId,
      fileName,
      fileType: contentType,
      fileSize: fileSize != null ? BigInt(fileSize) : null,
      s3Key,
    });

    return formatAttachment(attachment);
  }

  async listAttachments(itemId: string): Promise<FormattedAttachment[]> {
    const attachments = await this.repository.findManyByItemId(itemId);
    return attachments.map(formatAttachment);
  }

  async getDownloadUrl(
    itemId: string,
    id: string,
  ) {
    const attachment = await this.repository.findByIdAndItemId(id, itemId);
    if (!attachment) {
      throw this.options.notFoundError('Attachment', id);
    }

    return this.storage.getPresignedDownloadUrl(
      attachment.s3Key,
      this.options.presignTtl,
    );
  }

  async getAttachment(
    itemId: string,
    id: string,
  ): Promise<AttachmentRecord | null> {
    return this.repository.findByIdAndItemId(id, itemId);
  }

  async removeAttachment(itemId: string, id: string): Promise<void> {
    const attachment = await this.repository.findByIdAndItemId(id, itemId);
    if (!attachment) {
      throw this.options.notFoundError('Attachment', id);
    }

    await this.storage.delete(attachment.s3Key);
    await this.repository.deleteById(id);
  }
}
