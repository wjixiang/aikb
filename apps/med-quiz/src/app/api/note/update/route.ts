// src/app/api/note/update/route.ts
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/mongodb';
import { note } from '@/types/noteData.types';

export async function POST(req: Request) {
  const body = await req.json();
  const { oid, metaData, content }: note = body.reqestData;

  if (!oid || !content || content.length === 0) {
    return NextResponse.json(
      { message: 'Missing required fields' },
      { status: 400 },
    );
  }

  try {
    const { client, db } = await connectToDatabase();
    // 指定集合的类型为 note
    const collection = db.collection<note>('note');
    // 新要插入的内容
    const newContent = {
      timeStamp: new Date(),
      fileContent: content[0].fileContent,
    };

    const result = await collection.updateOne(
      { oid },
      {
        $push: { content: newContent },
        $set: { metaData },
      },
    );

    if (result.modifiedCount === 0) {
      return NextResponse.json(
        { message: 'No document found or no changes made' },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { message: 'Content updated successfully' },
      { status: 200 },
    );
  } catch (error) {
    console.error('Error updating note:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 },
    );
  }
}
