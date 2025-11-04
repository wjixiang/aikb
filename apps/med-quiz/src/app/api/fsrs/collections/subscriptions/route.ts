import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/mongodb';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/authOptions';
import {
  AnkiCollectionPreset,
  CardState,
  UserSubscription,
} from '@/types/anki.types';
import { ObjectId } from 'mongodb';
import { refreshAllCollection } from '@/lib/fsrs/refreshCollection';

// 获取用户所有订阅
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    //刷新用户的所有牌组集合状态
    await refreshAllCollection(session.user?.email as string);
    const { db } = await connectToDatabase();

    const subscriptions = await db
      .collection<UserSubscription>('userSubscriptions')
      .find({ userId: session.user?.email as string })
      .toArray();

    console.log(subscriptions);

    return NextResponse.json(subscriptions);
  } catch (error) {
    console.error('Error in GET /api/collections/subscriptions:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// 更新订阅参数
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const data = await request.json();

    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: 'Invalid subscription ID' },
        { status: 400 },
      );
    }

    const { db } = await connectToDatabase();

    // 检查订阅是否存在且属于当前用户
    const existingSub = await db.collection('userSubscriptions').findOne({
      _id: new ObjectId(id),
      userId: session.user?.email,
    });

    if (!existingSub) {
      return NextResponse.json(
        { error: 'Subscription not found' },
        { status: 404 },
      );
    }

    // 只允许更新fsrsParams字段
    const updateResult = await db.collection('userSubscriptions').updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          fsrsParams: {
            ...existingSub.fsrsParams,
            ...data.fsrsParams,
          },
        },
      },
    );

    if (updateResult.modifiedCount === 0) {
      return NextResponse.json(
        { error: 'No changes applied' },
        { status: 400 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in PATCH /api/collections/subscriptions/[id]:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// 删除订阅
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: 'Invalid subscription ID' },
        { status: 400 },
      );
    }

    const { db } = await connectToDatabase();

    // 删除订阅
    const deleteResult = await db.collection('userSubscriptions').deleteOne({
      _id: new ObjectId(id),
      userId: session.user?.email,
    });

    if (deleteResult.deletedCount === 0) {
      return NextResponse.json(
        { error: 'Subscription not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(
      'Error in DELETE /api/collections/subscriptions/[id]:',
      error,
    );
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// 创建新订阅
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data: UserSubscription = await request.json();

    if (!data.collectionId) {
      return NextResponse.json(
        { error: 'Collection ID is required' },
        { status: 400 },
      );
    }

    const { db } = await connectToDatabase();

    // 检查牌组是否存在
    const collection = await db
      .collection<AnkiCollectionPreset>('presetCollections')
      .findOne({
        _id: new ObjectId(data.collectionId),
      });

    if (!collection) {
      console.log('Collection not found');
      return NextResponse.json(
        { error: 'Collection not found' },
        { status: 404 },
      );
    }

    // 检查是否已订阅
    const existingSubscription = await db
      .collection<UserSubscription>('userSubscriptions')
      .findOne({
        userId: session.user?.email as string,
        collectionId: data.collectionId,
      });

    if (existingSubscription) {
      return NextResponse.json(
        { error: 'Already subscribed' },
        { status: 409 },
      );
    }

    // 创建订阅
    const subscription: UserSubscription = {
      userId: session.user?.email as string,
      collectionId: data.collectionId,
      collectionName: collection.collectionName,
      collectionDescription: collection.description,
      cardCount: collection.cards.length,
      createdAt: new Date(),
      dueCount: 0,
      reviewedToday: 0,
      reviewCardsCount: 0,
      newCardsToday: 0,
      newCardsCount: 0,
      lastRefreshed: new Date(),
      fsrsParams: data.fsrsParams || {
        requestRetention: 0.9,
        maximumInterval: 36500,
        weights: [
          0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01, 1.49, 0.14, 0.94, 2.18,
          0.05, 0.34, 1.26, 0.29,
        ],
      },
      scheduleParams: data.scheduleParams || {
        newCardsPerDay: 20,
        maxReviewsPerDay: 200,
        learningSteps: [1, 10],
        lapseSteps: [10],
      },
    };

    const result = await db
      .collection('userSubscriptions')
      .insertOne(subscription as any);

    // 为每张卡片初始化状态
    const cardStates: CardState[] = collection.cards.map(
      (card: { oid: string }) => ({
        userId: session.user?.email as string,
        cardOid: card.oid,
        collectionId: data.collectionId,
        state: {
          due: null,
          stability: 0,
          difficulty: 0,
          elapsed_days: 0,
          scheduled_days: 0,
          reps: 0,
          lapses: 0,
          state: 0, // New
          last_review: null,
        },
      }),
    );

    await db.collection('cardStates').insertMany(cardStates);

    return NextResponse.json({
      success: true,
      subscriptionId: result.insertedId,
    });
  } catch (error) {
    console.error('Error in POST /api/collections/subscriptions:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
