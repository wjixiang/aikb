import { NextResponse } from 'next/server';
import knowledgeBase from '@/kgrag/knowledgeBase';
import { connectToDatabase } from '@/lib/db/mongodb';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const query = searchParams.get('query') || '';
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = parseInt(searchParams.get('offset') || '0');
  const collection =
    searchParams.get('collection') ||
    process.env.KB_MONGO_COLLECTION_NAME ||
    'notes';
  const sortBy = searchParams.get('sortBy') || 'lastModified';
  const sortOrder = searchParams.get('sortOrder') || 'desc';

  // 解析标签参数
  const tagsParam = searchParams.get('tags');
  const tags = tagsParam ? tagsParam.split(',') : [];

  console.log('=== DEBUG: Search API Called ===');
  console.log('Query:', query);
  console.log('Collection:', collection);
  console.log(
    'KB_MONGO_COLLECTION_NAME:',
    process.env.KB_MONGO_COLLECTION_NAME,
  );
  console.log('Using collection:', collection);

  try {
    const { db } = await connectToDatabase();
    console.log('Connected to MongoDB');

    const mongoCollection = db.collection(collection);
    console.log('Collection name:', mongoCollection.collectionName);

    // 获取集合中的所有文档用于调试
    const allDocs = await mongoCollection.find({}).limit(5).toArray();
    console.log(
      'Sample documents:',
      allDocs.map((doc) => ({ key: doc.key, hasContent: !!doc.content })),
    );

    // 构建查询条件
    const filter: any = {};

    if (query) {
      console.log('Adding query filter:', query);
      filter.key = { $regex: query, $options: 'i' };
    }

    if (tags.length > 0) {
      console.log('Adding tags filter:', tags);
      filter['metadata.tags'] = { $in: tags };
    }

    console.log('Final filter:', JSON.stringify(filter));

    // 获取总数
    const total = await mongoCollection.countDocuments(filter);
    console.log('Total documents found:', total);

    // 获取文档
    const documents = await mongoCollection
      .find(filter)
      .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
      .skip(offset)
      .limit(limit)
      .toArray();

    console.log('Documents returned:', documents.length);
    console.log(
      'Sample returned docs:',
      documents.map((doc) => doc.key),
    );

    const results = documents.map((doc) => ({
      path: doc.key,
      title:
        doc.key
          .split('/')
          .pop()
          ?.replace(/\.(md|txt|markdown)$/i, '') || doc.key,
      content: doc.content?.substring(0, 200) || '',
      type: 'document' as const,
      lastModified: doc.lastModified || new Date(),
    }));

    console.log('=== DEBUG: Search Complete ===');

    return NextResponse.json(
      {
        results,
        total,
        hasMore: offset + limit < total,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('Error searching documents:', error);
    return NextResponse.json(
      {
        message: 'Internal server error',
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      query = '',
      limit = 50,
      offset = 0,
      collection = process.env.KB_MONGO_COLLECTION_NAME || 'notes',
      tags = [],
      sortBy = 'lastModified',
      sortOrder = 'desc',
    } = body;

    console.log('=== DEBUG: POST Search API Called ===');
    console.log('Body:', body);

    const { db } = await connectToDatabase();
    const mongoCollection = db.collection(collection);

    console.log('Collection name:', mongoCollection.collectionName);

    // 构建查询条件
    const filter: any = {};

    if (query) {
      filter.key = { $regex: query, $options: 'i' };
    }

    if (tags.length > 0) {
      filter['metadata.tags'] = { $in: tags };
    }

    console.log('Filter:', JSON.stringify(filter));

    // 获取总数
    const total = await mongoCollection.countDocuments(filter);

    // 获取文档
    const documents = await mongoCollection
      .find(filter)
      .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
      .skip(offset)
      .limit(limit)
      .toArray();

    const results = documents.map((doc) => ({
      path: doc.key,
      title:
        doc.key
          .split('/')
          .pop()
          ?.replace(/\.(md|txt|markdown)$/i, '') || doc.key,
      content: doc.content?.substring(0, 200) || '',
      type: 'document' as const,
      lastModified: doc.lastModified || new Date(),
    }));

    return NextResponse.json(
      {
        results,
        total,
        hasMore: offset + limit < total,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('Error searching documents:', error);
    return NextResponse.json(
      {
        message: 'Internal server error',
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
