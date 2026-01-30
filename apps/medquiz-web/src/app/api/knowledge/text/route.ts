import { NextResponse } from 'next/server';
import knowledgeBase from '@/kgrag/knowledgeBase';
import { connectToDatabase } from '@/lib/db/mongodb';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const encodedKey = searchParams.get('key');

  console.log('=== DEBUG: Text API Called ===');
  console.log('Raw encoded key:', encodedKey);
  console.log('Collection:', process.env.KB_MONGO_COLLECTION_NAME);

  if (!encodedKey) {
    console.log('Missing key parameter');
    return NextResponse.json(
      { message: 'Missing key parameter' },
      { status: 400 },
    );
  }

  // URL decode the key
  const key = decodeURIComponent(encodedKey);
  console.log('Decoded key:', key);
  console.log('Key length:', key.length);
  console.log(
    'Key characters:',
    [...key].map((c) => `${c}:${c.charCodeAt(0)}`).join(', '),
  );

  try {
    const { db } = await connectToDatabase();
    console.log('Connected to MongoDB');

    const collectionName = process.env.KB_MONGO_COLLECTION_NAME || 'notes';
    const collection = db.collection(collectionName);
    console.log('Using collection:', collection.collectionName);

    // 获取所有文档用于调试
    const allDocs = await collection.find({}).limit(20).toArray();
    console.log('Total documents in collection:', allDocs.length);
    console.log(
      'All documents keys:',
      allDocs.map((doc) => doc.key),
    );

    // 检查是否有中文路径的文档
    const chineseDocs = allDocs.filter((doc) =>
      /[\u4e00-\u9fa5]/.test(doc.key),
    );
    console.log(
      'Documents with Chinese characters:',
      chineseDocs.map((doc) => doc.key),
    );

    // 尝试多种匹配方式
    let document = null;

    // 1. 精确匹配（解码后的key）
    console.log('1. Trying exact match with decoded key:', key);
    document = await collection.findOne({ key });

    // 2. 尝试原始编码的key
    if (!document) {
      console.log('2. Trying with original encoded key:', encodedKey);
      document = await collection.findOne({ key: encodedKey });
    }

    // 3. 如果key不包含.md，尝试添加.md
    if (!document && !key.includes('.md')) {
      const keyWithMd = key + '.md';
      console.log('3. Trying with .md extension:', keyWithMd);
      document = await collection.findOne({ key: keyWithMd });
    }

    // 4. 尝试包含匹配（更宽松的匹配）
    if (!document) {
      console.log('4. Trying contains match with decoded key:', key);
      document = await collection.findOne({
        key: {
          $regex: key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
          $options: 'i',
        },
      });
    }

    // 5. 尝试从文件名匹配
    if (!document) {
      const filename = key.split('/').pop();
      if (filename) {
        console.log('5. Trying filename match:', filename);
        document = await collection.findOne({
          key: {
            $regex: filename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
            $options: 'i',
          },
        });
      }
    }

    console.log(
      'Found document:',
      document ? { key: document.key, title: document.title } : 'Not found',
    );

    if (!document) {
      console.log('Document not found for key:', key);
      console.log('Document not found for encoded key:', encodedKey);
      console.log(
        'Available keys (first 20):',
        allDocs.map((doc) => doc.key).slice(0, 20),
      );

      // 尝试模糊匹配建议
      const suggestions = allDocs
        .filter((doc) => {
          const docKey = doc.key.toLowerCase();
          const searchKey = key.toLowerCase();
          return docKey.includes(searchKey) || searchKey.includes(docKey);
        })
        .slice(0, 5)
        .map((doc) => doc.key);

      return NextResponse.json(
        {
          message: 'Document not found',
          searchedKey: key,
          encodedKey: encodedKey,
          suggestions,
          availableKeys: allDocs.map((doc) => doc.key).slice(0, 20),
          debugInfo: {
            decodedKey: key,
            encodedKey: encodedKey,
            keyLength: key.length,
            totalDocuments: allDocs.length,
            chineseDocumentsCount: chineseDocs.length,
          },
        },
        { status: 404 },
      );
    }

    const response = {
      key: document.key,
      title:
        document.key
          .split('/')
          .pop()
          ?.replace(/\.(md|txt|markdown)$/i, '') || document.key,
      content: document.content || '',
      lastModified: document.lastModified || new Date(),
      metadata: document.metadata || {},
    };

    console.log('=== DEBUG: Text API Complete ===');
    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('Error fetching document:', error);
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
    const { key: encodedKey } = body;

    console.log('=== DEBUG: POST Text API Called ===');
    console.log('Raw encoded key:', encodedKey);

    if (!encodedKey) {
      return NextResponse.json(
        { message: 'Missing key parameter' },
        { status: 400 },
      );
    }

    // URL decode the key
    const key = decodeURIComponent(encodedKey);
    console.log('Decoded key:', key);

    const { db } = await connectToDatabase();
    const collectionName = process.env.KB_MONGO_COLLECTION_NAME || 'notes';
    const collection = db.collection(collectionName);

    let document = null;

    // 1. 精确匹配（解码后的key）
    console.log('1. Trying exact match with decoded key:', key);
    document = await collection.findOne({ key });

    // 2. 尝试原始编码的key
    if (!document) {
      console.log('2. Trying with original encoded key:', encodedKey);
      document = await collection.findOne({ key: encodedKey });
    }

    // 3. 如果key不包含.md，尝试添加.md
    if (!document && !key.includes('.md')) {
      const keyWithMd = key + '.md';
      console.log('3. Trying with .md extension:', keyWithMd);
      document = await collection.findOne({ key: keyWithMd });
    }

    // 4. 尝试包含匹配
    if (!document) {
      console.log('4. Trying contains match with decoded key:', key);
      document = await collection.findOne({
        key: { $regex: key, $options: 'i' },
      });
    }

    if (!document) {
      return NextResponse.json(
        { message: 'Document not found' },
        { status: 404 },
      );
    }

    const response = {
      key: document.key,
      title:
        document.key
          .split('/')
          .pop()
          ?.replace(/\.(md|txt|markdown)$/i, '') || document.key,
      content: document.content || '',
      lastModified: document.lastModified || new Date(),
      metadata: document.metadata || {},
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('Error fetching document:', error);
    return NextResponse.json(
      {
        message: 'Internal server error',
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
