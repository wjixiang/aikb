import { Prisma } from '../generated/prisma/client.js';
import { prisma } from '../db.js';
import type {
  IItemRepository,
  ItemRecord,
  ItemQuery,
  CreateItemInput,
  UpdateItemInput,
} from 'bib-item-plugin';

export function createItemRepository(): IItemRepository {
  return {
    async findMany(query: ItemQuery) {
      const page = query.page ?? 1;
      const pageSize = query.pageSize ?? 20;
      const sortBy = query.sortBy ?? 'createdAt';
      const sortOrder = query.sortOrder ?? 'desc';
      const skip = (page - 1) * pageSize;

      const where: Record<string, unknown> = {};
      if (query.type) where.type = query.type;
      if (query.isFavorite !== undefined) where.isFavorite = query.isFavorite;

      if (query.search) {
        where.OR = [
          { title: { contains: query.search, mode: 'insensitive' } },
          { subtitle: { contains: query.search, mode: 'insensitive' } },
          { authors: { has: query.search } },
          { source: { contains: query.search, mode: 'insensitive' } },
          { doi: { contains: query.search, mode: 'insensitive' } },
        ];
      }

      if (query.tagIds && query.tagIds.length > 0) {
        where.tags = {
          some: {
            tagId: { in: query.tagIds },
          },
        };
      }

      const orderBy = { [sortBy]: sortOrder } as Record<string, string>;

      const [items, total] = await Promise.all([
        prisma.item.findMany({
          where,
          skip,
          take: pageSize,
          orderBy,
          include: { tags: { include: { tag: true } } },
        }),
        prisma.item.count({ where }),
      ]);

      return {
        items: items as unknown as ItemRecord[],
        total,
      };
    },

    async findById(id: string) {
      return (await prisma.item.findUnique({
        where: { id },
        include: { tags: { include: { tag: true } } },
      })) as unknown as ItemRecord | null;
    },

    async create(input: CreateItemInput) {
      const { tagIds = [], pmid, customMeta, ...data } = input;

      return (await prisma.item.create({
        data: {
          ...data,
          pmid: pmid ? BigInt(pmid) : null,
          customMeta:
            customMeta === null
              ? Prisma.JsonNull
              : (customMeta as Prisma.InputJsonValue | undefined),
          tags: {
            create: tagIds.map((tagId) => ({ tagId })),
          },
        },
        include: { tags: { include: { tag: true } } },
      })) as unknown as ItemRecord;
    },

    async update(id: string, input: UpdateItemInput) {
      const { tagIds, pmid, ...data } = input;
      const updateData: Record<string, unknown> = { ...data };
      if (pmid !== undefined) {
        updateData.pmid = pmid ? BigInt(pmid) : null;
      }

      if (tagIds !== undefined) {
        await prisma.itemTag.deleteMany({ where: { itemId: id } });
        await prisma.item.update({
          where: { id },
          data: {
            ...updateData,
            tags: { create: tagIds.map((tagId: string) => ({ tagId })) },
          },
        });
      } else {
        await prisma.item.update({ where: { id }, data: updateData });
      }

      const item = await prisma.item.findUnique({
        where: { id },
        include: { tags: { include: { tag: true } } },
      });

      return item as unknown as ItemRecord;
    },

    async delete(id: string) {
      const existing = await prisma.item.findUnique({
        where: { id },
        include: { attachments: { select: { s3Key: true } } },
      });
      if (!existing) {
        throw new Error(`Item with id ${id} not found`);
      }

      const s3Keys = existing.attachments.map((att) => att.s3Key);
      await prisma.item.delete({ where: { id } });
      return { s3Keys };
    },

    async deleteTagsByItemId(itemId: string) {
      await prisma.itemTag.deleteMany({ where: { itemId } });
    },

    async setItemTags(itemId: string, tagIds: string[]) {
      await prisma.itemTag.deleteMany({ where: { itemId } });
      await prisma.item.update({
        where: { id: itemId },
        data: {
          tags: { create: tagIds.map((tagId) => ({ tagId })) },
        },
      });

      const item = await prisma.item.findUnique({
        where: { id: itemId },
        include: { tags: { include: { tag: true } } },
      });
      return item as unknown as ItemRecord;
    },

    async batchDelete(ids: string[]) {
      await prisma.itemTag.deleteMany({ where: { itemId: { in: ids } } });
      const result = await prisma.item.deleteMany({
        where: { id: { in: ids } },
      });
      return result.count;
    },

    async batchSetTags(ids: string[], tagIds: string[]) {
      await prisma.$transaction(
        ids.map((itemId) =>
          prisma.itemTag.deleteMany({ where: { itemId } }),
        ),
      );
      await prisma.itemTag.createMany({
        data: ids.flatMap((itemId) =>
          tagIds.map((tagId) => ({ itemId, tagId })),
        ),
      });
    },

    async batchAddTags(ids: string[], tagIds: string[]) {
      await prisma.itemTag.createMany({
        data: ids.flatMap((itemId) =>
          tagIds.map((tagId) => ({ itemId, tagId })),
        ),
        skipDuplicates: true,
      });
    },

    async batchRemoveTags(ids: string[], tagIds: string[]) {
      await prisma.itemTag.deleteMany({
        where: { itemId: { in: ids }, tagId: { in: tagIds } },
      });
    },

    async batchToggleFavorite(ids: string[]) {
      const items = await prisma.item.findMany({
        where: { id: { in: ids } },
        select: { id: true, isFavorite: true },
      });
      await prisma.$transaction(
        items.map((item: { id: string; isFavorite: boolean }) =>
          prisma.item.update({
            where: { id: item.id },
            data: { isFavorite: !item.isFavorite },
          }),
        ),
      );
      return items;
    },
  };
}
