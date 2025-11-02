import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongodb";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/authOptions";
import {
  getFsrsInstance,
  processReview,
  convertToFsrsItem,
  convertFromFsrsItem,
} from "@/lib/fsrs/fsrs";
import { CardState, UserSubscription } from "@/types/anki.types";
import { ObjectId } from "mongodb";
import { refreshCollection } from "@/lib/fsrs/refreshCollection";

/**
 * Interface representing the structure of the review request payload.
 */
export interface ReviewRequestPayload {
  /**
   * The unique identifier of the card being reviewed.
   */
  cardOid: string;

  /**
   * The rating given by the user for the card review.
   * Must be a number between 1 and 4 inclusive.
   */
  rating: number;

  /**
   * The time elapsed during the review of the card.
   * This field is optional.
   */
  elapsedTime?: number;
}

/**
 * 处理卡片的复习结果并更新相关状态。
 *
 * 该函数接收一个 HTTP POST 请求，其中包含卡片的唯一标识符和用户的评分。
 * 它会验证用户会话，检查卡片和用户订阅的有效性，并使用 FSRS 算法更新卡片的复习状态。
 * 最后，它会记录复习日志并更新用户的复习统计信息。
 *
 * @param request - HTTP 请求对象，包含复习数据的 JSON 负载。
 *
 * @returns 返回一个 JSON 响应，包含操作的结果。
 * - 成功时，返回 `success: true` 和新的到期日期 `newDueDate`。
 * - 如果会话无效，返回 `error: 'Unauthorized'` 和 HTTP 状态码 401。
 * - 如果请求数据无效，返回 `error: 'Invalid data'` 和 HTTP 状态码 400。
 * - 如果找不到卡片状态或订阅，返回 `error: 'Card state not found'` 或 `error: 'Subscription not found'` 和 HTTP 状态码 404。
 * - 如果发生服务器错误，返回 `error: 'Server error'` 和 HTTP 状态码 500。
 *
 * @throws 可能抛出与数据库连接或查询相关的错误。
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data: ReviewRequestPayload = await request.json();

    if (!data.cardOid || !data.rating || data.rating < 1 || data.rating > 4) {
      return NextResponse.json({ error: "Invalid data" }, { status: 400 });
    }

    const { db } = await connectToDatabase();

    // 获取卡片状态
    const cardState = await db.collection<CardState>("cardStates").findOne({
      userId: session.user?.email as string,
      cardOid: data.cardOid,
    });

    if (!cardState) {
      return NextResponse.json(
        { error: "Card state not found" },
        { status: 404 },
      );
    }

    // 找到包含这张卡片的牌组
    const presetCollections = await db
      .collection("presetCollections")
      .find({
        "cards.oid": data.cardOid,
      })
      .toArray();

    if (presetCollections.length === 0) {
      return NextResponse.json(
        { error: "Card not found in any collection" },
        { status: 404 },
      );
    }

    const collectionIds = presetCollections.map((c) => c._id.toString());

    // 找到用户订阅的这个牌组
    const subscription = await db.collection("userSubscriptions").findOne({
      userId: session.user?.email,
      collectionId: { $in: collectionIds },
    });

    if (!subscription) {
      return NextResponse.json(
        { error: "Subscription not found" },
        { status: 404 },
      );
    }

    // 创建FSRS实例
    const fsrs = getFsrsInstance(subscription.fsrsParams);

    // 转换为FSRS格式
    const fsrsItem = convertToFsrsItem(cardState);

    // 处理复习
    const reviewedAt = new Date();
    const newFsrsItem = processReview(fsrs, fsrsItem, data.rating, reviewedAt);

    // 更新卡片状态
    await db
      .collection("cardStates")
      .updateOne(
        { _id: cardState._id },
        { $set: { state: convertFromFsrsItem(newFsrsItem) } },
      );

    // 记录复习日志
    await db.collection("reviewLogs").insertOne({
      userId: session.user?.email,
      cardOid: data.cardOid,
      rating: data.rating,
      reviewedAt: reviewedAt,
      elapsedTime: data.elapsedTime || 0,
    });

    // 更新用户的复习统计
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (cardState.state.state === 0) {
      // 更新新学记录
      await db.collection<UserSubscription>("userSubscriptions").updateOne(
        { _id: new ObjectId(subscription._id) },
        {
          $inc: {
            // reviewedToday: 1,  // 增加今日复习计数
            newCardsToday: 1,
          },
          $set: {
            dueCount: await db.collection("cardStates").countDocuments({
              userId: session.user?.email,
              "state.due": { $lte: new Date() },
            }),
          },
        },
      );
    } else {
      // 更新复习记录
      await db.collection("userSubscriptions").updateOne(
        { _id: new ObjectId(subscription._id) },
        {
          $inc: {
            reviewedToday: 1, // 增加今日复习计数
          },
          $set: {
            dueCount: await db.collection("cardStates").countDocuments({
              userId: session.user?.email,
              "state.due": { $lte: new Date() },
            }),
          },
        },
      );
    }

    // 刷新集合状态
    await refreshCollection(
      session.user?.email as string,
      cardState.collectionId,
    );

    return NextResponse.json({
      success: true,
      newDueDate: newFsrsItem.due,
    });
  } catch (error) {
    console.error("Error in POST /api/fsrs/review:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
