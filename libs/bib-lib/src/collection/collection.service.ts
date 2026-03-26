/**
 * Collection Service for BibMax
 *
 * Manages hierarchical collections for organizing articles.
 */

import { prisma } from '../prisma';
import type { Collection, ArticleCollection } from '../generated/prisma';

// ============ Types ============

export interface CreateCollectionInput {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  parentId?: string;
}

export interface UpdateCollectionInput {
  name?: string;
  description?: string;
  color?: string;
  icon?: string;
  parentId?: string;
}

export interface CollectionWithStats extends Collection {
  _count: {
    articles: number;
    children: number;
  };
  children?: CollectionWithStats[];
}

// ============ Collection CRUD ============

/**
 * Get all collections for a library (tree structure)
 */
export async function getCollections(
  libraryId: string,
  userId: string
): Promise<CollectionWithStats[]> {
  // Verify library ownership through library
  const library = await prisma.library.findUnique({
    where: { id: libraryId },
    select: { userId: true },
  });

  if (!library || library.userId !== userId) {
    throw new Error('Library not found or access denied');
  }

  // Get root collections (no parent)
  const rootCollections = await prisma.collection.findMany({
    where: {
      libraryId,
      parentId: null,
    },
    include: {
      _count: {
        select: {
          articles: true,
          children: true,
        },
      },
      orderBy: { sortOrder: 'asc' },
    },
  });

  // Recursively load children
  return Promise.all(
    rootCollections.map((col) => loadCollectionTree(col as CollectionWithStats))
  );
}

/**
 * Recursively load collection tree with stats
 */
async function loadCollectionTree(
  collection: CollectionWithStats
): Promise<CollectionWithStats> {
  // Load children
  const children = await prisma.collection.findMany({
    where: {
      parentId: collection.id,
    },
    include: {
      _count: {
        select: {
          articles: true,
          children: true,
        },
      },
    },
    orderBy: { sortOrder: 'asc' },
  });

  collection.children = await Promise.all(
    children.map((child) => loadCollectionTree(child as CollectionWithStats))
  );

  return collection;
}

/**
 * Get a single collection by ID
 */
export async function getCollection(
  collectionId: string,
  userId: string
): Promise<Collection | null> {
  const collection = await prisma.collection.findUnique({
    where: { id: collectionId },
    include: {
      library: {
        select: { userId: true },
      },
    },
  });

  if (!collection || collection.library.userId !== userId) {
    return null;
  }

  return collection;
}

/**
 * Create a new collection
 */
export async function createCollection(
  libraryId: string,
  userId: string,
  input: CreateCollectionInput
): Promise<Collection> {
  // Verify ownership
  const library = await prisma.library.findUnique({
    where: { id: libraryId },
    select: { userId: true },
  });

  if (!library || library.userId !== userId) {
    throw new Error('Library not found or access denied');
  }

  // Get max sort order in this level
  const siblings = await prisma.collection.findMany({
    where: {
      libraryId,
      parentId: input.parentId || null,
    },
    orderBy: { sortOrder: 'desc' },
    take: 1,
  });

  return prisma.collection.create({
    data: {
      libraryId,
      ...input,
      sortOrder: (siblings[0]?.sortOrder ?? -1) + 1,
    },
  });
}

/**
 * Update a collection
 */
export async function updateCollection(
  collectionId: string,
  userId: string,
  input: UpdateCollectionInput
): Promise<Collection> {
  const collection = await prisma.collection.findUnique({
    where: { id: collectionId },
    include: {
      library: {
        select: { userId: true },
      },
    },
  });

  if (!collection || collection.library.userId !== userId) {
    throw new Error('Collection not found or access denied');
  }

  // Prevent circular reference in hierarchy
  if (input.parentId) {
    await checkCircularReference(collectionId, input.parentId);
  }

  return prisma.collection.update({
    where: { id: collectionId },
    data: input,
  });
}

/**
 * Delete a collection
 * Note: Articles within the collection are not deleted, only the collection-article links
 */
export async function deleteCollection(
  collectionId: string,
  userId: string
): Promise<void> {
  const collection = await prisma.collection.findUnique({
    where: { id: collectionId },
    include: {
      library: {
        select: { userId: true },
      },
    },
  });

  if (!collection || collection.library.userId !== userId) {
    throw new Error('Collection not found or access denied');
  }

  // Cascade delete: article links, children collections
  await prisma.collection.delete({
    where: { id: collectionId },
  });
}

/**
 * Move collection to new parent
 */
export async function moveCollection(
  collectionId: string,
  userId: string,
  newParentId: string | null
): Promise<Collection> {
  const collection = await prisma.collection.findUnique({
    where: { id: collectionId },
    include: {
      library: {
        select: { userId: true },
      },
    },
  });

  if (!collection || collection.library.userId !== userId) {
    throw new Error('Collection not found or access denied');
  }

  // Prevent circular reference
  if (newParentId) {
    await checkCircularReference(collectionId, newParentId);
  }

  // Get max sort order in target level
  const siblings = await prisma.collection.findMany({
    where: {
      libraryId: collection.libraryId,
      parentId: newParentId,
    },
    orderBy: { sortOrder: 'desc' },
    take: 1,
  });

  return prisma.collection.update({
    where: { id: collectionId },
    data: {
      parentId: newParentId,
      sortOrder: (siblings[0]?.sortOrder ?? -1) + 1,
    },
  });
}

/**
 * Reorder collections at the same level
 */
export async function reorderCollections(
  libraryId: string,
  userId: string,
  collectionIds: string[]
): Promise<void> {
  // Verify ownership
  const library = await prisma.library.findUnique({
    where: { id: libraryId },
    select: { userId: true },
  });

  if (!library || library.userId !== userId) {
    throw new Error('Library not found or access denied');
  }

  // Update sort orders in transaction
  await prisma.$transaction(
    collectionIds.map((id, index) =>
      prisma.collection.update({
        where: { id },
        data: { sortOrder: index },
      })
    )
  );
}

/**
 * Add articles to collection
 */
export async function addArticlesToCollection(
  collectionId: string,
  userId: string,
  articleRefIds: string[]
): Promise<void> {
  const collection = await prisma.collection.findUnique({
    where: { id: collectionId },
    include: {
      library: {
        select: { userId: true },
      },
    },
  });

  if (!collection || collection.library.userId !== userId) {
    throw new Error('Collection not found or access denied');
  }

  await prisma.articleCollection.createMany({
    data: articleRefIds.map((articleRefId) => ({
      articleRefId,
      collectionId,
    })),
    skipDuplicates: true,
  });
}

/**
 * Remove articles from collection
 */
export async function removeArticlesFromCollection(
  collectionId: string,
  userId: string,
  articleRefIds: string[]
): Promise<void> {
  const collection = await prisma.collection.findUnique({
    where: { id: collectionId },
    include: {
      library: {
        select: { userId: true },
      },
    },
  });

  if (!collection || collection.library.userId !== userId) {
    throw new Error('Collection not found or access denied');
  }

  await prisma.articleCollection.deleteMany({
    where: {
      collectionId,
      articleRefId: { in: articleRefIds },
    },
  });
}

// ============ Helpers ============

/**
 * Check for circular reference in collection hierarchy
 */
async function checkCircularReference(
  collectionId: string,
  newParentId: string
): Promise<void> {
  let currentId = newParentId;
  const visited = new Set<string>();

  while (currentId) {
    if (currentId === collectionId) {
      throw new Error('Cannot move collection into its own descendant');
    }

    if (visited.has(currentId)) {
      break; // Already checked this branch
    }

    visited.add(currentId);

    const parent = await prisma.collection.findUnique({
      where: { id: currentId },
      select: { parentId: true },
    });

    currentId = parent?.parentId || null;
  }
}
