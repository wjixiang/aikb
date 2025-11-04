import { NextResponse, NextRequest } from 'next/server';
import { connectToDatabase } from '@/lib/db/mongodb';
import { AnkiCollectionPreset } from '@/types/anki.types';
import { ObjectId } from 'mongodb';

/**
 * 获取所有preset collections
 * @returns AnkiCollectionPreset[]
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { db } = await connectToDatabase();
    const params = await context.params;
    // console.log(params)

    // 获取所有的预设牌组信息
    const preSets = await db
      .collection<AnkiCollectionPreset>('presetCollections')
      .findOne({ _id: new ObjectId(params.id) });
    // console.log(preSets)
    return NextResponse.json(preSets);
  } catch (error) {
    console.error('Error in GET /api/fsrs/collections/preset:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
