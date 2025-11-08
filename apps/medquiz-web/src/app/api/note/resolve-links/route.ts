import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/mongodb';
import { note } from '@/types/noteData.types';
import { ObjectId } from 'mongodb';

export async function POST(req: Request) {
  try {
    const { links } = await req.json();

    if (!Array.isArray(links) || links.length === 0) {
      return NextResponse.json({ links: {} }, { status: 200 });
    }

    const { db } = await connectToDatabase();
    const collection = db.collection<note>('note');

    // 查询所有匹配的文档
    const matchingNotes = await collection
      .find({
        $or: [
          { fileName: { $in: links } },
          { 'metaData.title': { $in: links } },
        ],
      })
      .project({
        _id: 1,
        oid: 1,
        fileName: 1,
        'metaData.title': 1,
      })
      .toArray();

    // 构建链接映射
    const linkMap: Record<string, string> = {};

    matchingNotes.forEach((note) => {
      // 使用文件名作为键
      if (note.fileName && links.includes(note.fileName)) {
        linkMap[note.fileName] = note.oid || note._id.toString();
      }

      // 使用标题作为键
      if (note.metaData?.title && links.includes(note.metaData.title)) {
        linkMap[note.metaData.title] = note.oid || note._id.toString();
      }
    });

    return NextResponse.json({ links: linkMap }, { status: 200 });
  } catch (error) {
    console.error('解析链接错误:', error);
    return NextResponse.json(
      { message: '解析链接失败', error: String(error) },
      { status: 500 },
    );
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const oid = searchParams.get('oid');
  const title = searchParams.get('title');

  if (!oid && !title) {
    return NextResponse.json(
      { message: 'Missing oid or title parameter' },
      { status: 400 },
    );
  }

  try {
    const { db } = await connectToDatabase();
    const collection = db.collection<note>('note');

    let document;

    if (oid) {
      // 尝试使用oid查询
      try {
        // 首先尝试将oid作为字符串字段查询
        document = await collection.findOne({ oid: oid });

        // 如果没找到，尝试将oid作为ObjectId查询
        if (!document && ObjectId.isValid(oid)) {
          document = await collection.findOne({ _id: new ObjectId(oid) });
        }
      } catch (err) {
        console.error('Error querying by oid:', err);
      }
    }

    // 如果通过oid没找到，尝试使用title查询
    if (!document && title) {
      document = await collection.findOne({
        $or: [{ fileName: title }, { 'metaData.title': title }],
      });
    }

    if (!document) {
      return NextResponse.json(
        { message: 'No document found' },
        { status: 404 },
      );
    }

    // 确保返回的文档有oid字段
    const responseDoc = {
      ...document,
      oid: document.oid || document._id.toString(),
    };

    return NextResponse.json({ note: responseDoc }, { status: 200 });
  } catch (error) {
    console.error('Error querying document:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 },
    );
  }
}
