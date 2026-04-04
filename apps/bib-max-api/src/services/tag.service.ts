import { prisma } from '../db.js';
import { NotFoundError } from '../errors.js';

// ============ Query Types ============

export interface TagQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  withCount?: boolean;
}

export interface CreateTagInput {
  name: string;
  color?: string;
  description?: string;
}

export interface UpdateTagInput {
  name?: string;
  color?: string;
  description?: string;
}

// ============ Formatted Types ============

export interface FormattedTag {
  id: string;
  name: string;
  color: string | null;
  description: string | null;
  createdAt: Date;
  itemCount?: number;
}

export interface PaginatedTags {
  data: FormattedTag[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

// ============ Service Functions ============

function formatTag(tag: Record<string, unknown> & { _count?: { items: number } }): FormattedTag {
  const { _count, ...tagData } = tag;
  return {
    id: tagData.id as string,
    name: tagData.name as string,
    color: tagData.color as string | null,
    description: tagData.description as string | null,
    createdAt: tagData.createdAt as Date,
    itemCount: _count?.items,
  };
}

export async function listTags(query: TagQuery): Promise<PaginatedTags> {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 50;
  const withCount = query.withCount ?? false;
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = {};
  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: 'insensitive' } },
      { description: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  const [tags, total] = await Promise.all([
    prisma.tag.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      include: withCount ? { _count: { select: { items: true } } } : undefined,
    }),
    prisma.tag.count({ where }),
  ]);

  return {
    data: tags.map((tag) => formatTag(tag as unknown as Record<string, unknown> & { _count?: { items: number } })),
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
}

export async function getTagById(id: string): Promise<FormattedTag> {
  const tag = await prisma.tag.findUnique({
    where: { id },
    include: { _count: { select: { items: true } } },
  });

  if (!tag) {
    throw new NotFoundError('Tag', id);
  }

  return formatTag(tag as unknown as Record<string, unknown> & { _count?: { items: number } });
}

export async function createTag(input: CreateTagInput) {
  return prisma.tag.create({ data: input });
}

export async function updateTag(id: string, input: UpdateTagInput) {
  const existing = await prisma.tag.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError('Tag', id);
  }

  return prisma.tag.update({ where: { id }, data: input });
}

export async function removeTag(id: string): Promise<void> {
  const existing = await prisma.tag.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError('Tag', id);
  }

  await prisma.tag.delete({ where: { id } });
}
