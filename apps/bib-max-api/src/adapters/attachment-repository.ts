import { prisma } from '../db.js';
import type {
  IAttachmentRepository,
  AttachmentRecord,
} from 'bib-item-plugin';

export function createAttachmentRepository(): IAttachmentRepository {
  return {
    async create(data) {
      return (await prisma.attachment.create({
        data,
      })) as unknown as AttachmentRecord;
    },

    async findManyByItemId(itemId: string) {
      const attachments = await prisma.attachment.findMany({
        where: { itemId },
        orderBy: { createdAt: 'desc' },
      });
      return attachments as unknown as AttachmentRecord[];
    },

    async findByIdAndItemId(id: string, itemId: string) {
      return (await prisma.attachment.findFirst({
        where: { id, itemId },
      })) as unknown as AttachmentRecord | null;
    },

    async deleteById(id: string) {
      await prisma.attachment.delete({ where: { id } });
    },
  };
}
