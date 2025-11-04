import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/mongodb';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/authOptions';
import { ObjectId } from 'mongodb';

export async function POST(request: NextRequest) {
  try {
    // Get user session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const { text, title, isPublic = false, sentences } = await request.json();

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json(
        { error: 'Text content is required' },
        { status: 400 },
      );
    }

    // Connect to database
    const { db } = await connectToDatabase();

    // Use provided sentences or split the text
    const finalSentences =
      sentences ||
      text
        .split(/(?<!\w\.\w.)(?<![A-Z][a-z]\.)(?<=[.!?])\s+/)
        .filter((s: string) => s.trim().length > 0);

    // Create translation practice document
    const translationDoc = {
      userId: new ObjectId(session.user.id),
      text: text.trim(),
      title: title?.trim() || 'Untitled Translation Practice',
      sentences: finalSentences,
      isPublic: Boolean(isPublic),
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'active',
    };

    // Insert into database
    const result = await db
      .collection('translationPractice')
      .insertOne(translationDoc);

    // Create indexes if they don't exist
    try {
      await db
        .collection('translationPractice')
        .createIndex({ userId: 1, createdAt: -1 });
      await db
        .collection('translationPractice')
        .createIndex({ userId: 1, status: 1 });
      await db
        .collection('translationPractice')
        .createIndex({ isPublic: 1, createdAt: -1 });
    } catch (indexError) {
      console.warn('Index creation failed (may already exist):', indexError);
    }

    return NextResponse.json({
      success: true,
      documentId: result.insertedId.toString(),
      sentenceCount: translationDoc.sentences.length,
    });
  } catch (error) {
    console.error('Error uploading translation practice:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get user session
    const session = await getServerSession(authOptions);

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const scope = searchParams.get('scope') || 'private'; // 'private', 'public', or 'all'

    // Connect to database
    const { db } = await connectToDatabase();

    let query: any = { status: 'active' };

    if (scope === 'public') {
      // Get all public documents
      query.isPublic = true;
    } else if (scope === 'all' && session?.user?.id) {
      // Get user's documents plus public documents
      query.$or = [
        { userId: new ObjectId(session.user.id) },
        { isPublic: true },
      ];
    } else if (session?.user?.id) {
      // Default: get only user's private documents
      query.userId = new ObjectId(session.user.id);
    } else {
      // Not authenticated, only get public documents
      query.isPublic = true;
    }

    // Get documents based on query
    const documents = await db
      .collection('translationPractice')
      .find(query)
      .sort({ createdAt: -1 })
      .limit(scope === 'public' ? 100 : 50)
      .toArray();

    // Convert ObjectId to string for JSON serialization
    const serializedDocuments = documents.map((doc) => ({
      id: doc._id.toString(),
      userId: doc.userId.toString(),
      title: doc.title,
      text: doc.text,
      sentences: doc.sentences,
      isPublic: doc.isPublic,
      createdAt: doc.createdAt,
      sentenceCount: doc.sentences.length,
      isOwner: session?.user?.id === doc.userId.toString(),
    }));

    return NextResponse.json({
      success: true,
      documents: serializedDocuments,
      scope: scope,
    });
  } catch (error) {
    console.error('Error fetching translation practice documents:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Get user session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const { documentId, isPublic } = await request.json();

    if (!documentId) {
      return NextResponse.json(
        { error: 'Document ID is required' },
        { status: 400 },
      );
    }

    // Connect to database
    const { db } = await connectToDatabase();

    // Update document privacy setting
    const result = await db.collection('translationPractice').updateOne(
      {
        _id: new ObjectId(documentId),
        userId: new ObjectId(session.user.id),
      },
      {
        $set: {
          isPublic: Boolean(isPublic),
          updatedAt: new Date(),
        },
      },
    );

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { error: 'Document not found or access denied' },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Privacy setting updated successfully',
    });
  } catch (error) {
    console.error('Error updating privacy setting:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
