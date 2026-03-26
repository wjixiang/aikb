/**
 * Library Service for BibMax
 *
 * Manages user libraries, article references, and library-level operations.
 */

import { prisma } from '../prisma';
import type {
  Library,
  Collection,
  Tag,
  ArticleRef,
  Article,
  ArticleCollection,
  ArticleTag,
  PdfAnnotation,
  Note,
} from '../generated/prisma';
import { AuthUser } from '../auth';

// ============ Types ============

export interface CreateLibraryInput {
  name: string;
  description?: string;
  isDefault?: boolean;
}

export interface UpdateLibraryInput {
  name?: string;
  description?: string;
}

export interface AddArticleInput {
  pmid: bigint;
  pdfUrl?: string;
  pdfFileName?: string;
  notes?: string;
  collectionIds?: string[];
  tagIds?: string[];
}

export interface ArticleRefWithDetails extends ArticleRef {
  article: Article;
  collections: (ArticleCollection & { collection: Collection })[];
  tags: (ArticleTag & { tag: Tag })[];
}

// ============ Library CRUD ============

/**
 * Get user's default library
 */
export async function getUserLibrary(userId: string): Promise<Library | null> {
  return prisma.library.findFirst({
    where: {
      userId,
      isDefault: true,
    },
  });
}

/**
 * Get all libraries for a user
 */
export async function getUserLibraries(userId: string): Promise<Library[]> {
  return prisma.library.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
  });
}

/**
 * Create a new library for user
 */
export async function createLibrary(
  userId: string,
  input: CreateLibraryInput
): Promise<Library> {
  return prisma.library.create({
    data: {
      userId,
      ...input,
    },
  });
}

/**
 * Update library
 */
export async function updateLibrary(
  libraryId: string,
  userId: string,
  input: UpdateLibraryInput
): Promise<Library> {
  // Verify ownership
  await verifyLibraryOwnership(libraryId, userId);

  return prisma.library.update({
    where: { id: libraryId },
    data: input,
  });
}

/**
 * Delete library
 * Note: Cannot delete default library
 */
export async function deleteLibrary(libraryId: string, userId: string): Promise<void> {
  const library = await prisma.library.findUnique({
    where: { id: libraryId },
  });

  if (!library || library.userId !== userId) {
    throw new Error('Library not found');
  }

  if (library.isDefault) {
    throw new Error('Cannot delete default library');
  }

  await prisma.library.delete({
    where: { id: libraryId },
  });
}

/**
 * Verify library ownership
 */
async function verifyLibraryOwnership(libraryId: string, userId: string): Promise<void> {
  const library = await prisma.library.findUnique({
    where: { id: libraryId },
    select: { userId: true },
  });

  if (!library || library.userId !== userId) {
    throw new Error('Library not found or access denied');
  }
}

// ============ Article Reference Management ============

/**
 * Add an article to user's library
 */
export async function addArticleToLibrary(
  libraryId: string,
  userId: string,
  input: AddArticleInput
): Promise<ArticleRef> {
  // Verify ownership
  await verifyLibraryOwnership(libraryId, userId);

  // Check if article exists in global Article table
  let article = await prisma.article.findUnique({
    where: { pmid: input.pmid },
  });

  // If not, create a placeholder (sync from PubMed later)
  if (!article) {
    article = await prisma.article.create({
      data: {
        pmid: input.pmid,
        articleTitle: 'Pending sync from PubMed...',
      },
    });
  }

  // Create or update article reference
  const articleRef = await prisma.articleRef.upsert({
    where: {
      libraryId_pmid: {
        libraryId,
        pmid: input.pmid,
      },
    },
    update: {
      pdfUrl: input.pdfUrl,
      pdfFileName: input.pdfFileName,
      notes: input.notes,
      updatedAt: new Date(),
    },
    create: {
      libraryId,
      pmid: input.pmid,
      pdfUrl: input.pdfUrl,
      pdfFileName: input.pdfFileName,
      notes: input.notes,
    },
  });

  // Link to collections
  if (input.collectionIds && input.collectionIds.length > 0) {
    await prisma.articleCollection.createMany({
      data: input.collectionIds.map((collectionId) => ({
        articleRefId: articleRef.id,
        collectionId,
      })),
      skipDuplicates: true,
    });
  }

  // Link to tags
  if (input.tagIds && input.tagIds.length > 0) {
    await prisma.articleTag.createMany({
      data: input.tagIds.map((tagId) => ({
        articleRefId: articleRef.id,
        tagId,
      })),
      skipDuplicates: true,
    });
  }

  return articleRef;
}

/**
 * Remove article from library
 */
export async function removeArticleFromLibrary(
  libraryId: string,
  pmid: bigint,
  userId: string
): Promise<void> {
  await verifyLibraryOwnership(libraryId, userId);

  await prisma.articleRef.deleteMany({
    where: {
      libraryId,
      pmid,
    },
  });
}

/**
 * Get article references from library with pagination
 */
export async function getLibraryArticles(
  libraryId: string,
  userId: string,
  options: {
    collectionId?: string;
    tagId?: string;
    search?: string;
    limit?: number;
    offset?: number;
    sortBy?: 'dateAdded' | 'dateAccessed' | 'title';
    sortOrder?: 'asc' | 'desc';
  } = {}
): Promise<{ articles: ArticleRefWithDetails[]; total: number }> {
  await verifyLibraryOwnership(libraryId, userId);

  const { limit = 20, offset = 0, sortBy = 'dateAdded', sortOrder = 'desc' } = options;

  const where: any = { libraryId };

  // Filter by collection
  if (options.collectionId) {
    where.collections = {
      some: { collectionId: options.collectionId },
    };
  }

  // Filter by tag
  if (options.tagId) {
    where.tags = {
      some: { tagId: options.tagId },
    };
  }

  // Search in article title
  if (options.search) {
    where.article = {
      articleTitle: {
        contains: options.search,
        mode: 'insensitive',
      },
    };
  }

  const [articles, total] = await Promise.all([
    prisma.articleRef.findMany({
      where,
      include: {
        article: true,
        collections: {
          include: { collection: true },
        },
        tags: {
          include: { tag: true },
        },
      },
      orderBy: { [sortBy]: sortOrder },
      take: limit,
      skip: offset,
    }),
    prisma.articleRef.count({ where }),
  ]);

  return { articles: articles as ArticleRefWithDetails[], total };
}

/**
 * Get article reference by ID
 */
export async function getArticleRef(
  articleRefId: string,
  userId: string
): Promise<ArticleRefWithDetails | null> {
  const articleRef = await prisma.articleRef.findUnique({
    where: { id: articleRefId },
    include: {
      article: true,
      collections: {
        include: { collection: true },
      },
      tags: {
        include: { tag: true },
      },
    },
  });

  if (!articleRef) {
    return null;
  }

  // Verify ownership through library
  await verifyLibraryOwnership(articleRef.libraryId, userId);

  return articleRef as ArticleRefWithDetails;
}

/**
 * Update article reference
 */
export async function updateArticleRef(
  articleRefId: string,
  userId: string,
  data: {
    notes?: string;
    isFavorite?: boolean;
    isRead?: boolean;
    rating?: number;
  }
): Promise<ArticleRef> {
  const articleRef = await prisma.articleRef.findUnique({
    where: { id: articleRefId },
    select: { libraryId: true },
  });

  if (!articleRef) {
    throw new Error('Article reference not found');
  }

  await verifyLibraryOwnership(articleRef.libraryId, userId);

  return prisma.articleRef.update({
    where: { id: articleRefId },
    data,
  });
}

/**
 * Update article access time (for sorting by "recently used")
 */
export async function touchArticleRef(articleRefId: string, userId: string): Promise<void> {
  const articleRef = await prisma.articleRef.findUnique({
    where: { id: articleRefId },
    select: { libraryId: true },
  });

  if (!articleRef) {
    return;
  }

  await verifyLibraryOwnership(articleRef.libraryId, userId);

  await prisma.articleRef.update({
    where: { id: articleRefId },
    data: { dateAccessed: new Date() },
  });
}

// ============ Statistics ============

/**
 * Get library statistics
 */
export async function getLibraryStats(
  libraryId: string,
  userId: string
): Promise<{
  totalArticles: number;
  favoriteCount: number;
  readCount: number;
  unreadCount: number;
  collectionCount: number;
  tagCount: number;
}> {
  await verifyLibraryOwnership(libraryId, userId);

  const [total, favorite, read, unread, collections, tags] = await Promise.all([
    prisma.articleRef.count({ where: { libraryId } }),
    prisma.articleRef.count({ where: { libraryId, isFavorite: true } }),
    prisma.articleRef.count({ where: { libraryId, isRead: true } }),
    prisma.articleRef.count({ where: { libraryId, isRead: false } }),
    prisma.collection.count({ where: { libraryId } }),
    prisma.tag.count({ where: { libraryId } }),
  ]);

  return {
    totalArticles: total,
    favoriteCount: favorite,
    readCount: read,
    unreadCount: unread,
    collectionCount: collections,
    tagCount: tags,
  };
}
