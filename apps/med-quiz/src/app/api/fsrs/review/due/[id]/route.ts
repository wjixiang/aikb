import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongodb";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/authOptions";
import { ObjectId } from "mongodb";

/**
 * 获取指定 collectionId 的所有待复习的卡片
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    const param = await params;

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // const { searchParams } = new URL(request.url);
    const collectionId = param.id;

    if (!collectionId) {
      return NextResponse.json(
        { error: "Collection ID is required" },
        { status: 400 },
      );
    }

    const { db } = await connectToDatabase();

    // 获取属于指定 collectionId 的所有到期的卡片
    const now = new Date();
    const dueCards = await db
      .collection("cardStates")
      .find({
        userId: session.user?.email,
        "state.due": { $lte: now },
      })
      .toArray();

    if (dueCards.length === 0) {
      return NextResponse.json([]);
    }

    // 获取这些卡片的详细信息
    const cardOids = dueCards.map((card) => card.cardOid);

    // 找到所有包含这些卡片的预设牌组
    const collections = await db
      .collection("presetCollections")
      .find({
        _id: new ObjectId(collectionId), // 仅匹配指定的 collectionId
        "cards.oid": { $in: cardOids },
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
    const enrichedCards = dueCards
      .filter((card) => cardDetails[card.cardOid]) // 仅包含属于指定 collectionId 的卡片
      .map((card: any) => ({
        _id: card._id,
        cardOid: card.cardOid,
        state: card.state,
        title: cardDetails[card.cardOid]?.title || "Unknown Card",
        collectionName:
          cardDetails[card.cardOid]?.collectionName || "Unknown Collection",
        collectionId: cardDetails[card.cardOid]?.collectionId,
      }));

    return NextResponse.json(enrichedCards);
  } catch (error) {
    console.error("Error in GET /api/fsrs/review/due:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
