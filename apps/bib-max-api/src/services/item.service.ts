import type { Prisma } from '../generated/prisma/client.js';
import { Prisma as PrismaNamespace } from '../generated/prisma/client.js';
import { prisma } from '../db.js';
import { NotFoundError } from '../errors.js';

// ============ Query Types ============

export interface ItemQuery {
  page?: number;
  pageSize?: number;
  type?: string;
  search?: string;
  tagIds?: string[];
  isFavorite?: boolean;
  isRead?: boolean;
  sortBy?: string;
  sortOrder?: string;
}

export interface CreateItemInput {
  tagIds?: string[];
  pmid?: string;
  type?: string;
  title: string;
  subtitle?: string;
  authors?: string[];
  abstract?: string;
  year?: number;
  source?: string;
  doi?: string;
  isbn?: string;
  url?: string;
  coverUrl?: string;
  notes?: string;
  isFavorite?: boolean;
  isRead?: boolean;
  rating?: number;
  customMeta?: unknown;
}

export interface UpdateItemInput {
  tagIds?: string[];
  pmid?: string;
  [key: string]: unknown;
}

// ============ Raw DB Types ============

interface RawItem {
  id: string;
  type: string;
  title: string;
  subtitle: string | null;
  authors: string[];
  abstract: string | null;
  year: number | null;
  source: string | null;
  doi: string | null;
  isbn: string | null;
  pmid: bigint | null;
  url: string | null;
  coverUrl: string | null;
  notes: string | null;
  isFavorite: boolean;
  isRead: boolean;
  rating: number | null;
  customMeta: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
  tags?: Array<{ tag: { id: string; name: string; color: string | null; description: string | null } }>;
}

// ============ Formatted Types ============

export interface FormattedItem {
  id: string;
  type: 'article' | 'book';
  title: string;
  subtitle: string | null;
  authors: string[];
  abstract: string | null;
  year: number | null;
  source: string | null;
  doi: string | null;
  isbn: string | null;
  pmid: string | null;
  url: string | null;
  coverUrl: string | null;
  notes: string | null;
  isFavorite: boolean;
  isRead: boolean;
  rating: number | null;
  customMeta: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
  tags: Array<{ id: string; name: string; color: string | null; description: string | null }>;
}

export interface PaginatedItems {
  data: FormattedItem[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

// ============ Service Functions ============

export function formatItem(item: RawItem): FormattedItem {
  return {
    ...item,
    type: item.type as 'article' | 'book',
    pmid: item.pmid?.toString() ?? null,
    tags: item.tags?.map((it) => it.tag) ?? [],
  };
}

export async function listItems(query: ItemQuery): Promise<PaginatedItems> {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;
  const sortBy = query.sortBy ?? 'createdAt';
  const sortOrder = query.sortOrder ?? 'desc';
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = {};
  if (query.type) where.type = query.type;
  if (query.isFavorite !== undefined) where.isFavorite = query.isFavorite;
  if (query.isRead !== undefined) where.isRead = query.isRead;

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
    data: items.map(formatItem),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

export async function getItemById(id: string): Promise<FormattedItem> {
  const item = await prisma.item.findUnique({
    where: { id },
    include: { tags: { include: { tag: true } } },
  });

  if (!item) {
    throw new NotFoundError('Item', id);
  }

  return formatItem(item);
}

export async function createItem(input: CreateItemInput): Promise<FormattedItem> {
  const { tagIds = [], pmid, customMeta, ...data } = input;

  const item = await prisma.item.create({
    data: {
      ...data,
      pmid: pmid ? BigInt(pmid) : null,
      customMeta: customMeta === null ? PrismaNamespace.JsonNull : customMeta as Prisma.InputJsonValue | undefined,
      tags: {
        create: tagIds.map((tagId) => ({ tagId })),
      },
    },
    include: { tags: { include: { tag: true } } },
  });

  return formatItem(item);
}

export async function updateItem(id: string, input: UpdateItemInput): Promise<FormattedItem> {
  const existing = await prisma.item.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError('Item', id);
  }

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

  return formatItem(item!);
}

export async function removeItem(id: string): Promise<void> {
  const existing = await prisma.item.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError('Item', id);
  }

  await prisma.item.delete({ where: { id } });
}

export async function setItemTags(id: string, tagIds: string[]): Promise<FormattedItem> {
  const existing = await prisma.item.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError('Item', id);
  }

  await prisma.itemTag.deleteMany({ where: { itemId: id } });
  await prisma.item.update({
    where: { id },
    data: { tags: { create: tagIds.map((tagId) => ({ tagId })) } },
  });

  const item = await prisma.item.findUnique({
    where: { id },
    include: { tags: { include: { tag: true } } },
  });

  return formatItem(item!);
}

export interface BatchResult {
  success: boolean;
  updated: number;
  deleted?: number;
}

export async function batchOperation(
  itemIds: string[],
  operation: string,
  tagIds?: string[],
): Promise<BatchResult> {
  switch (operation) {
    case 'delete': {
      await prisma.itemTag.deleteMany({ where: { itemId: { in: itemIds } } });
      const result = await prisma.item.deleteMany({ where: { id: { in: itemIds } } });
      return { success: true, updated: 0, deleted: result.count };
    }

    case 'setTags': {
      await prisma.$transaction(
        itemIds.map((itemId) => prisma.itemTag.deleteMany({ where: { itemId } })),
      );
      await prisma.itemTag.createMany({
        data: itemIds.flatMap((itemId) => tagIds!.map((tagId) => ({ itemId, tagId }))),
      });
      return { success: true, updated: itemIds.length };
    }

    case 'addTags': {
      await prisma.itemTag.createMany({
        data: itemIds.flatMap((itemId) => tagIds!.map((tagId) => ({ itemId, tagId }))),
        skipDuplicates: true,
      });
      return { success: true, updated: itemIds.length };
    }

    case 'removeTags': {
      await prisma.itemTag.deleteMany({
        where: { itemId: { in: itemIds }, tagId: { in: tagIds! } },
      });
      return { success: true, updated: itemIds.length };
    }

    case 'markAsRead': {
      await prisma.item.updateMany({ where: { id: { in: itemIds } }, data: { isRead: true } });
      return { success: true, updated: itemIds.length };
    }

    case 'markAsUnread': {
      await prisma.item.updateMany({ where: { id: { in: itemIds } }, data: { isRead: false } });
      return { success: true, updated: itemIds.length };
    }

    case 'toggleFavorite': {
      const items = await prisma.item.findMany({
        where: { id: { in: itemIds } },
        select: { id: true, isFavorite: true },
      });
      await prisma.$transaction(
        items.map((item: { id: string; isFavorite: boolean }) =>
          prisma.item.update({ where: { id: item.id }, data: { isFavorite: !item.isFavorite } }),
        ),
      );
      return { success: true, updated: items.length };
    }

    default:
      throw new Error(`Unknown batch operation: ${operation}`);
  }
}
