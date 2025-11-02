import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongodb";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/authOptions";
import { ObjectId } from "mongodb";

/**
 * 刷新userSubscribtion的状态
 * @param request
 * @returns
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { db } = await connectToDatabase();

    // Get all subscriptions for the user
    const subscriptions = await db
      .collection("userSubscriptions")
      .find({ userId: session.user?.email })
      .toArray();

    for (const subscription of subscriptions) {
      // Count due cards for this subscription
      const dueCount = await db.collection("cardStates").countDocuments({
        userId: session.user?.email,
        "state.due": { $lte: new Date() },
        cardOid: {
          $in: subscription.collection.cards.map((card: any) => card.oid),
        },
      });

      // Update subscription
      await db.collection("userSubscriptions").updateOne(
        { _id: new ObjectId(subscription._id) },
        {
          $set: {
            dueCount: dueCount,
            reviewedToday: 0, // Reset daily review count
          },
        },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in POST /api/fsrs/refresh:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
