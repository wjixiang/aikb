// src/app/api/note/delete/route.ts
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/mongodb';

export async function DELETE(req: Request) {
  // 通过 URL 查询参数获取 oid
  const { searchParams } = new URL(req.url);
  const oid = searchParams.get('oid');

  if (!oid) {
    return NextResponse.json({ message: 'Missing oid' }, { status: 400 });
  }

  try {
    const { client, db } = await connectToDatabase();
    const collection = db.collection('note'); // 替换为实际集合名称

    const result = await collection.deleteOne({ oid });

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { message: 'No document found' },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { message: 'Document deleted successfully' },
      { status: 200 },
    );
  } catch (error) {
    console.error('Error deleting document:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 },
    );
  }
}
