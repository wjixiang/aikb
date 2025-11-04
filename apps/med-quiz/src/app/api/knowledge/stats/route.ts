import { NextResponse } from 'next/server';
import knowledgeBase from '@/kgrag/knowledgeBase';
import { connectToDatabase } from '@/lib/db/mongodb';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const collection =
    searchParams.get('collection') ||
    process.env.KB_MONGO_COLLECTION_NAME ||
    'notes';

  try {
    // 优先使用MongoDB S3同步的集合
    if (collection === process.env.KB_MONGO_COLLECTION_NAME) {
      const { db } = await connectToDatabase();
      const mongoCollection = db.collection(collection);

      const [totalDocuments, documents] = await Promise.all([
        mongoCollection.countDocuments(),
        mongoCollection.find({}).toArray(),
      ]);

      const totalSize = documents.reduce(
        (sum, doc) => sum + (doc.content?.length || 0),
        0,
      );

      const tags = [
        ...new Set(documents.flatMap((doc) => doc.metadata?.tags || [])),
      ];

      const lastSync =
        documents.length > 0
          ? new Date(
              Math.max(...documents.map((d) => d.lastModified?.getTime() || 0)),
            )
          : null;

      return NextResponse.json(
        {
          totalDocuments,
          totalSize,
          lastSync,
          tags,
        },
        { status: 200 },
      );
    }

    const kb = new knowledgeBase();
    const stats = await kb.getStats(collection);

    return NextResponse.json(stats, { status: 200 });
  } catch (error) {
    console.error('Error getting knowledge base stats:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { collection = process.env.KB_MONGO_COLLECTION_NAME || 'notes' } =
      body;

    // 优先使用MongoDB S3同步的集合
    if (collection === process.env.KB_MONGO_COLLECTION_NAME) {
      const { db } = await connectToDatabase();
      const mongoCollection = db.collection(collection);

      const [totalDocuments, documents] = await Promise.all([
        mongoCollection.countDocuments(),
        mongoCollection.find({}).toArray(),
      ]);

      const totalSize = documents.reduce(
        (sum, doc) => sum + (doc.content?.length || 0),
        0,
      );

      const tags = [
        ...new Set(documents.flatMap((doc) => doc.metadata?.tags || [])),
      ];

      const lastSync =
        documents.length > 0
          ? new Date(
              Math.max(...documents.map((d) => d.lastModified?.getTime() || 0)),
            )
          : null;

      return NextResponse.json(
        {
          totalDocuments,
          totalSize,
          lastSync,
          tags,
        },
        { status: 200 },
      );
    }

    const kb = new knowledgeBase();
    const stats = await kb.getStats(collection);

    return NextResponse.json(stats, { status: 200 });
  } catch (error) {
    console.error('Error getting knowledge base stats:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 },
    );
  }
}
