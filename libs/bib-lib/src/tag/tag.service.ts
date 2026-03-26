/**
 * Tag Service for BibMax
 *
 * Manages tags for organizing articles.
 */

import { prisma } from '../prisma';
import type { Tag, ArticleTag } from '../generated/prisma';

// ============ Types ============

export interface CreateTagInput {
  name: string;
  color?: string;
}

export interface UpdateTagInput {
  name?: string;
  color?: string;
}

export interface TagWithStats extends Tag {
  _count: {
    articles: number;
  };
}

// ============ Tag CRUD ============

/**
 * Get all tags for a library
 */
export async function getTags(
  libraryId: string,
  userId: string,
  options?: {
    search?: string;
  }
): Promise<TagWithStats[]> {
  // Verify library ownership
  const library = await prisma.library.findUnique({
    where: { id: libraryId },
    select: { userId: true },
  });

  if (!library || library.userId !== userId) {
    throw new Error('Library not found or access denied');
  }

  const where: any = { libraryId };

  if (options?.search) {
    where.name = {
      contains: options.search,
      mode: 'insensitive',
    };
  }

  return prisma.tag.findMany({
    where,
    include: {
      _count: {
        select: { articles: true },
      },
    },
    orderBy: { name: 'asc' },
  }) as Promise<TagWithStats[]>;
}

/**
 * Get a single tag by ID
 */
export async function getTag(tagId: string, userId: string): Promise<Tag | null> {
  const tag = await prisma.tag.findUnique({
    where: { id: tagId },
    include: {
      library: {
        select: { userId: true },
      },
    },
  });

  if (!tag || tag.library.userId !== userId) {
    return null;
  }

  return tag;
}

/**
 * Create or update a tag (upsert)
 */
export async function upsertTag(
  libraryId: string,
  userId: string,
  input: CreateTagInput
): Promise<Tag> {
  // Verify ownership
  const library = await prisma.library.findUnique({
    where: { id: libraryId },
    select: { userId: true },
  });

  if (!library || library.userId !== userId) {
    throw new Error('Library not found or access denied');
  }

  return prisma.tag.upsert({
    where: {
      libraryId_name: {
        libraryId,
        name: input.name,
      },
    },
    update: {
      color: input.color,
    },
    create: {
      libraryId,
      name: input.name,
      color: input.color,
    },
  });
}

/**
 * Update a tag
 */
export async function updateTag(
  tagId: string,
  userId: string,
  input: UpdateTagInput
): Promise<Tag> {
  const tag = await prisma.tag.findUnique({
    where: { id: tagId },
    include: {
      library: {
        select: { userId: true },
      },
    },
  });

  if (!tag || tag.library.userId !== userId) {
    throw new Error('Tag not found or access denied');
  }

  return prisma.tag.update({
    where: { id: tagId },
    data: input,
  });
}

/**
 * Delete a tag
 * Note: Articles with this tag will have the tag association removed
 */
export async function deleteTag(tagId: string, userId: string): Promise<void> {
  const tag = await prisma.tag.findUnique({
    where: { id: tagId },
    include: {
      library: {
        select: { userId: true },
      },
    },
  });

  if (!tag || tag.library.userId !== userId) {
    throw new Error('Tag not found or access denied');
  }

  await prisma.tag.delete({
    where: { id: tagId },
  });
}

/**
 * Merge tags (merge source into target)
 * All articles with source tag will have target tag added, then source tag is deleted
 */
export async function mergeTags(
  sourceTagId: string,
  targetTagId: string,
  userId: string
): Promise<void> {
  // Verify both tags belong to user
  const [source, target] = await Promise.all([
    prisma.tag.findUnique({
      where: { id: sourceTagId },
      include: { library: { select: { userId: true } } },
    }),
    prisma.tag.findUnique({
      where: { id: targetTagId },
      include: { library: { select: { userId: true } } },
    }),
  ]);

  if (!source || source.library.userId !== userId) {
    throw new Error('Source tag not found or access denied');
  }

  if (!target || target.library.userId !== userId) {
    throw new Error('Target tag not found or access denied');
  }

  // Get all article refs with source tag
  const articleTags = await prisma.articleTag.findMany({
    where: { tagId: sourceTagId },
    select: { articleRefId: true },
  });

  // Add target tag to those articles
  await prisma.articleTag.createMany({
    data: articleTags.map(({ articleRefId }) => ({
      articleRefId,
      tagId: targetTagId,
    })),
    skipDuplicates: true,
  });

  // Delete source tag (cascade will remove article-tag associations)
  await prisma.tag.delete({
    where: { id: sourceTagId },
  });
}

/**
 * Add tags to article
 */
export async function addTagsToArticle(
  articleRefId: string,
  userId: string,
  tagIds: string[]
): Promise<void> {
  // Verify article ref ownership
  const articleRef = await prisma.articleRef.findUnique({
    where: { id: articleRefId },
    include: {
      library: {
        select: { userId: true },
      },
    },
  });

  if (!articleRef || articleRef.library.userId !== userId) {
    throw new Error('Article reference not found or access denied');
  }

  // Verify all tags belong to same library
  const tags = await prisma.tag.findMany({
    where: {
      id: { in: tagIds },
      libraryId: articleRef.libraryId,
    },
  });

  if (tags.length !== tagIds.length) {
    throw new Error('Some tags not found or invalid');
  }

  await prisma.articleTag.createMany({
    data: tagIds.map((tagId) => ({
      articleRefId,
      tagId,
    })),
    skipDuplicates: true,
  });
}

/**
 * Remove tags from article
 */
export async function removeTagsFromArticle(
  articleRefId: string,
  userId: string,
  tagIds: string[]
): Promise<void> {
  // Verify ownership
  const articleRef = await prisma.articleRef.findUnique({
    where: { id: articleRefId },
    include: {
      library: {
        select: { userId: true },
      },
    },
  });

  if (!articleRef || articleRef.library.userId !== userId) {
    throw new Error('Article reference not found or access denied');
  }

  await prisma.articleTag.deleteMany({
    where: {
      articleRefId,
      tagId: { in: tagIds },
    },
  });
}

/**
 * Set article tags (replace all existing tags)
 */
export async function setArticleTags(
  articleRefId: string,
  userId: string,
  tagIds: string[]
): Promise<void> {
  // Verify ownership
  const articleRef = await prisma.articleRef.findUnique({
    where: { id: articleRefId },
    include: {
      library: {
        select: { userId: true },
      },
    },
  });

  if (!articleRef || articleRef.library.userId !== userId) {
    throw new Error('Article reference not found or access denied');
  }

  // Verify all tags belong to same library
  const tags = await prisma.tag.findMany({
    where: {
      id: { in: tagIds },
      libraryId: articleRef.libraryId,
    },
  });

  if (tags.length !== tagIds.length) {
    throw new Error('Some tags not found or invalid');
  }

  // Delete existing tags and add new ones in transaction
  await prisma.$transaction([
    prisma.articleTag.deleteMany({
      where: { articleRefId },
    }),
    prisma.articleTag.createMany({
      data: tagIds.map((tagId) => ({
        articleRefId,
        tagId,
      })),
    }),
  ]);
}

/**
 * Get popular tags across library
 */
export async function getPopularTags(
  libraryId: string,
  userId: string,
  limit: number = 20
): Promise<TagWithStats[]> {
  // Verify ownership
  const library = await prisma.library.findUnique({
    where: { id: libraryId },
    select: { userId: true },
  });

  if (!library || library.userId !== userId) {
    throw new Error('Library not found or access denied');
  }

  return prisma.tag.findMany({
    where: { libraryId },
    include: {
      _count: {
        select: { articles: true },
      },
    },
    orderBy: {
      articles: {
        _count: 'desc',
      },
    },
    take: limit,
  }) as Promise<TagWithStats[]>;
}
