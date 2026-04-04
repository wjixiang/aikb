import { prisma } from '../db.js';
import { storage } from '../storage/instance.js';
import { NotFoundError } from '../errors.js';
import { categorizeByMimeType, type AttachmentCategory } from '../schemas/attachment.schema.js';

// ============ Types ============

export interface PresignedUploadResult {
  attachmentId: string;
  url: string;
  expiresAt: Date;
}

export interface FormattedAttachment {
  id: string;
  itemId: string;
  fileName: string;
  fileType: string;
  fileSize: number | null;
  category: AttachmentCategory;
  createdAt: Date;
}

// ============ Helpers ============

function buildS3Key(itemId: string, attachmentId: string, fileName: string): string {
  const ext = fileName.split('.').pop() || '';
  return `attachments/${itemId}/${attachmentId}.${ext}`;
}

function formatAttachment(attachment: {
  id: string;
  itemId: string;
  fileName: string;
  fileType: string;
  fileSize: bigint | null;
  createdAt: Date;
}): FormattedAttachment {
  return {
    ...attachment,
    fileSize: attachment.fileSize != null ? Number(attachment.fileSize) : null,
    category: categorizeByMimeType(attachment.fileType),
  };
}

// ============ Service Functions ============

export async function generateUploadUrl(
  itemId: string,
  fileName: string,
  contentType: string,
): Promise<PresignedUploadResult> {
  const item = await prisma.item.findUnique({ where: { id: itemId } });
  if (!item) {
    throw new NotFoundError('Item', itemId);
  }

  const attachmentId = crypto.randomUUID();
  const s3Key = buildS3Key(itemId, attachmentId, fileName);
  const presigned = await storage.getPresignedUploadUrl(s3Key, contentType);

  return { attachmentId, url: presigned.url, expiresAt: presigned.expiresAt };
}

export async function confirmUpload(
  itemId: string,
  attachmentId: string,
  fileName: string,
  contentType: string,
  fileSize?: number,
): Promise<FormattedAttachment> {
  const item = await prisma.item.findUnique({ where: { id: itemId } });
  if (!item) {
    throw new NotFoundError('Item', itemId);
  }

  const s3Key = buildS3Key(itemId, attachmentId, fileName);
  const exists = await storage.exists(s3Key);
  if (!exists) {
    throw new NotFoundError('File', s3Key);
  }

  const attachment = await prisma.attachment.create({
    data: {
      itemId,
      fileName,
      fileType: contentType,
      fileSize: fileSize != null ? BigInt(fileSize) : null,
      s3Key,
    },
  });

  return formatAttachment(attachment);
}

export async function listAttachments(itemId: string): Promise<FormattedAttachment[]> {
  const item = await prisma.item.findUnique({ where: { id: itemId } });
  if (!item) {
    throw new NotFoundError('Item', itemId);
  }

  const attachments = await prisma.attachment.findMany({
    where: { itemId },
    orderBy: { createdAt: 'desc' },
  });

  return attachments.map(formatAttachment);
}

export async function getDownloadUrl(itemId: string, id: string) {
  const attachment = await prisma.attachment.findFirst({ where: { id, itemId } });
  if (!attachment) {
    throw new NotFoundError('Attachment', id);
  }

  return storage.getPresignedDownloadUrl(attachment.s3Key);
}

export async function removeAttachment(itemId: string, id: string): Promise<void> {
  const attachment = await prisma.attachment.findFirst({ where: { id, itemId } });
  if (!attachment) {
    throw new NotFoundError('Attachment', id);
  }

  await storage.delete(attachment.s3Key);
  await prisma.attachment.delete({ where: { id } });
}
