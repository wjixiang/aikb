/**
 * API endpoint for retrieving complete link graph
 */

import { NextResponse } from 'next/server';
import { LinkIndexingService } from '@/kgrag/services/linkIndexingService';
import { connectToDatabase } from '@/lib/db/mongodb';
import { ObjectId } from 'mongodb';

const linkService = new LinkIndexingService();

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get('documentId');
    const depth = parseInt(searchParams.get('depth') || '1', 10);

    if (!documentId) {
      return NextResponse.json(
        { error: 'documentId parameter is required' },
        { status: 400 },
      );
    }

    if (depth < 1 || depth > 3) {
      return NextResponse.json(
        { error: 'depth must be between 1 and 3' },
        { status: 400 },
      );
    }

    const { db } = await connectToDatabase();
    const documentsCollection = db.collection('knowledgeBase');

    // Get the main document
    const mainDoc = await documentsCollection.findOne({
      _id: new ObjectId(documentId),
    });
    if (!mainDoc) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 },
      );
    }

    // Get immediate link graph
    const linkGraph = await linkService.getLinkGraph(documentId);

    // If depth > 1, get extended graph
    let extendedGraph = null;
    if (depth > 1) {
      extendedGraph = await getExtendedGraph(documentId, depth);
    }

    return NextResponse.json({
      document: {
        id: mainDoc._id.toString(),
        key: mainDoc.key,
        title:
          mainDoc.title ||
          mainDoc.key
            .split('/')
            .pop()
            ?.replace(/\.(md|txt|markdown)$/i, ''),
        lastModified: mainDoc.lastModified || new Date(),
      },
      links: linkGraph,
      extended: extendedGraph,
    });
  } catch (error) {
    console.error('Error retrieving link graph:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve link graph' },
      { status: 500 },
    );
  }
}

async function getExtendedGraph(documentId: string, depth: number) {
  const linkService = new LinkIndexingService();
  const visited = new Set<string>();
  const graph = new Map<string, any>();

  async function buildGraph(currentId: string, currentDepth: number) {
    if (currentDepth <= 0 || visited.has(currentId)) {
      return;
    }

    visited.add(currentId);

    const [forwardLinks, backwardLinks] = await Promise.all([
      linkService.getForwardLinks(currentId),
      linkService.getBackwardLinks(currentId),
    ]);

    graph.set(currentId, {
      forward: forwardLinks,
      backward: backwardLinks,
    });

    // Recursively build graph for linked documents
    if (currentDepth > 1) {
      const linkedIds = [
        ...forwardLinks.map((link) => link.targetId),
        ...backwardLinks.map((link) => link.sourceId),
      ];

      for (const linkedId of linkedIds) {
        if (!visited.has(linkedId)) {
          await buildGraph(linkedId, currentDepth - 1);
        }
      }
    }
  }

  await buildGraph(documentId, depth);
  return Object.fromEntries(graph);
}
