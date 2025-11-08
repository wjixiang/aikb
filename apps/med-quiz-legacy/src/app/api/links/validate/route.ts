/**
 * API endpoint for validating links in a document
 */

import { NextResponse } from 'next/server';
import { LinkIndexingService } from '@/kgrag/services/linkIndexingService';

const linkService = new LinkIndexingService();

export async function POST(request: Request) {
  try {
    const { content, documentId } = await request.json();

    if (!content) {
      return NextResponse.json(
        { error: 'content is required' },
        { status: 400 },
      );
    }

    const validationResult = await linkService.validateLinks(content);

    return NextResponse.json(validationResult);
  } catch (error) {
    console.error('Error validating links:', error);
    return NextResponse.json(
      { error: 'Failed to validate links' },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get('documentId');

    if (!documentId) {
      return NextResponse.json(
        { error: 'documentId parameter is required' },
        { status: 400 },
      );
    }

    const { connectToDatabase } = await import('@/lib/db/mongodb');
    const { ObjectId } = await import('mongodb');
    const { db } = await connectToDatabase();
    const documentsCollection = db.collection('notes');

    const document = await documentsCollection.findOne({
      _id: new ObjectId(documentId),
    });
    if (!document || !document.content) {
      return NextResponse.json(
        { error: 'Document not found or has no content' },
        { status: 404 },
      );
    }

    const validationResult = await linkService.validateLinks(document.content);

    return NextResponse.json({
      documentId,
      ...validationResult,
    });
  } catch (error) {
    console.error('Error validating document links:', error);
    return NextResponse.json(
      { error: 'Failed to validate document links' },
      { status: 500 },
    );
  }
}
