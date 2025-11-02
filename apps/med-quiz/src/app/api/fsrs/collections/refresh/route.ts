"/api/fsrs/collections/refresh";

import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongodb";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/authOptions";
import { getFsrsInstance } from "@/lib/fsrs/fsrs";
import {
  UserSubscription,
  AnkiCollectionPreset,
  CardState,
} from "@/types/anki.types";
import { ObjectId } from "mongodb";
import { refreshCollection } from "@/lib/fsrs/refreshCollection";

async function getTodayNewLearned(userId: string, collectionId: string) {
  const { db } = await connectToDatabase();
  const Cards = await db
    .collection<CardState>("cardStates")
    .find({
      userId: userId,
      "state.due": { $lte: new Date() },
      collectionId: collectionId,
    })
    .toArray();
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { collectionId } = await request.json();
    if (!collectionId) {
      return NextResponse.json(
        { error: "Collection ID is required" },
        { status: 400 },
      );
    }

    const { db } = await connectToDatabase();

    // 检查订阅是否存在
    const subscription = await db
      .collection<UserSubscription>("userSubscriptions")
      .findOne({
        userId: session.user?.email as string,
        collectionId: collectionId,
      });

    if (!subscription) {
      return NextResponse.json(
        { error: "Subscription not found" },
        { status: 404 },
      );
    }

    // 获取牌组信息
    const collection = await db
      .collection<AnkiCollectionPreset>("presetCollections")
      .findOne({
        _id: new ObjectId(collectionId),
      });

    if (!collection) {
      return NextResponse.json(
        { error: "Collection not found" },
        { status: 404 },
      );
    }

    // 创建FSRS实例
    const fsrs = getFsrsInstance(
      subscription.fsrsParams as {
        requestRetention: number;
        maximumInterval: number;
        weights: number[];
      },
    );

    // 为每张卡片初始化或重置状态
    const cardStates = await db
      .collection("cardStates")
      .find({
        userId: session.user?.email,
        cardOid: { $in: collection.cards.map((card: any) => card.oid) },
      })
      .toArray();

    // 获取已存在的卡片ID
    const existingCardOids = cardStates.map((state: any) => state.cardOid);

    // 找出需要新建状态的卡片
    const newCards = collection.cards.filter(
      (card: any) => !existingCardOids.includes(card.oid),
    );

    // console.log("newcards",newCards.length)

    // 为新卡片创建状态
    if (newCards.length > 0) {
      const newCardStates = newCards.map((card: any) => ({
        userId: session.user?.email,
        cardOid: card.oid,
        title: card.title,
        collectionId: collectionId,
        collectionName: collection.collectionName,
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
      }));

      console.log(newCardStates);

      await db.collection("cardStates").insertMany(newCardStates);
    }

    await refreshCollection(session.user?.email as string, collectionId);

    return NextResponse.json({
      success: true,
      // dueCount: totalDueCount,
      // newCardsAdded: newCards.length,
      // newCardsAvailable: newCardCount,
      // reviewCardsAvailable: reviewCardCount,
      // isNewDay: isNewDay
    });
  } catch (error) {
    console.error("Error in POST /api/fsrs/collections/refresh:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
