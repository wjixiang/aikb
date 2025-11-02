import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongodb";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/authOptions";
import { ObjectId } from "mongodb";
import { UserSubscription } from "@/types/anki.types";

/**
 * 获取用户对特定集合的订阅状态
 *
 * @route GET /api/fsrs/collections/subscriptions/[id]
 *
 * @remarks
 * 查询当前登录用户对指定集合的订阅信息。需要用户已认证。
 *
 * @param request - 标准 HTTP 请求对象
 * @param params - 路由参数，包含集合 ID
 *
 * @returns 包含订阅信息的响应对象
 *
 * @throws {UnauthorizedError} 当用户未登录时返回 401 状态码
 * @throws {ServerError} 当服务器发生内部错误时返回 500 状态码
 *
 * @typeParam Request - Next.js 请求类型
 * @typeParam Params - collectionId
 *
 * @example
 * ```typescript
 * // 成功响应示例
 * {
 *   CollectionSubscription: {
 *     userId: 'user@example.com',
 *     collectionId: 'collection123',
 *     ...
 *   },
 *   success: true
 * }
 *
 * // 错误响应示例
 * {
 *   error: 'Unauthorized'
 * }
 * ```
 *
 * @beta
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const { db } = await connectToDatabase();

    const CollectionSubscription = await db
      .collection<UserSubscription>("userSubscriptions")
      .findOne({
        userId: session.user?.email as string,
        collectionId: id,
      });

    if (CollectionSubscription) {
      return NextResponse.json({
        CollectionSubscription: CollectionSubscription,
        success: true,
      });
    }
  } catch (error) {
    console.error("Error in GET /api/collections/subscriptions/[id]:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const data = await request.json();
    if (!id) {
      console.log("'Invalid subscription ID'", id);
      return NextResponse.json(
        { error: "Invalid subscription ID" },
        { status: 400 },
      );
    }

    const { db } = await connectToDatabase();

    // 检查订阅是否存在且属于当前用户
    const existingSub = await db
      .collection<UserSubscription>("userSubscriptions")
      .findOne({
        collectionId: id,
        userId: session.user?.email as string,
      });

    if (!existingSub) {
      return NextResponse.json(
        { error: "Subscription not found" },
        { status: 404 },
      );
    }

    // 只允许更新fsrsParams字段
    const updateResult = await db.collection("userSubscriptions").updateOne(
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
        { error: "No changes applied" },
        { status: 400 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in PATCH /api/collections/subscriptions/[id]:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: "Invalid subscription ID" },
        { status: 400 },
      );
    }

    // 获取MongoDB连接
    const { client, db } = await connectToDatabase();

    // 删除订阅和对应的cardStates记录
    const sessionUserEmail = session.user?.email as string;

    // 先获取订阅信息以获取collectionId
    const subscription = await db.collection("userSubscriptions").findOne({
      _id: new ObjectId(id),
      userId: sessionUserEmail,
    });

    if (!subscription) {
      return NextResponse.json(
        { error: "Subscription not found" },
        { status: 404 },
      );
    }
    const dbSession = client.startSession();

    try {
      await dbSession.withTransaction(async () => {
        // 删除订阅
        await db.collection("userSubscriptions").deleteOne(
          {
            _id: new ObjectId(id),
            userId: sessionUserEmail,
          },
          { session: dbSession },
        );

        // 删除对应的cardStates记录
        await db.collection("cardStates").deleteMany(
          {
            userId: sessionUserEmail,
            collectionId: subscription.collectionId,
          },
          { session: dbSession },
        );
      });

      return NextResponse.json({ success: true });
    } finally {
      await dbSession.endSession();
    }
  } catch (error) {
    console.error(
      "Error in DELETE /api/collections/subscriptions/[id]:",
      error,
    );
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
