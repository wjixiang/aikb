'/api/fsrs/review/new/[id]';
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/mongodb';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/authOptions';
import { ObjectId } from 'mongodb';
import { UserSubscription } from '@/types/anki.types';

/**
 * 获取指定集合的新学卡片
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const collectionId = (await params).id;

    const { db } = await connectToDatabase();

    // get current collection state to limit new cards count
    const CollectionSubscription = await db
      .collection<UserSubscription>('userSubscriptions')
      .findOne({
        userId: session.user?.email as string,
        collectionId: collectionId,
      });

    if (!CollectionSubscription) {
      console.error(
        'Error in GET /api/fsrs/review/new: subscription not found ',
        collectionId,
      );
      return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }

    // 获取属于指定 collectionId 的新卡片
    const dueCards = await db
      .collection('cardStates')
      .find({
        userId: session.user?.email,
        'state.state': 0, // 新卡片状态
        collectionId: collectionId, // 过滤出指定集合的卡片
      })
      .limit(CollectionSubscription?.newCardsCount)
      .toArray();

    // console.log(dueCards)

    if (dueCards.length === 0) {
      return NextResponse.json([]);
    }

    // 获取这些卡片的详细信息
    const cardOids = dueCards.map((card) => card.cardOid);

    // 找到所有包含这些卡片的预设牌组
    const collections = await db
      .collection('presetCollections')
      .find({
        _id: new ObjectId(collectionId), // 仅匹配指定的 collectionId
        'cards.oid': { $in: cardOids },
      })
      .toArray();

    // 从所有牌组中提取卡片详情
    interface CardDetail {
      title: string;
      collectionName: string;
      collectionId: string;
    }

    const cardDetails: Record<string, CardDetail> = {};
    collections.forEach((collection) => {
      collection.cards.forEach((card: { oid: string; title: string }) => {
        if (cardOids.includes(card.oid)) {
          cardDetails[card.oid] = {
            title: card.title,
            collectionName: collection.collectionName,
            collectionId: collection._id.toString(),
          };
        }
      });
    });

    // 合并卡片状态和详情
    const enrichedCards = dueCards.map((card: any) => ({
      _id: card._id,
      cardOid: card.cardOid,
      state: card.state,
      title: cardDetails[card.cardOid]?.title || 'Unknown Card',
      collectionName:
        cardDetails[card.cardOid]?.collectionName || 'Unknown Collection',
      collectionId: cardDetails[card.cardOid]?.collectionId,
    }));

    return NextResponse.json(enrichedCards);
  } catch (error) {
    console.error('Error in GET /api/fsrs/review/new:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
