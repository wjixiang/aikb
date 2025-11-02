import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongodb";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/authOptions";
import { QuizTag } from "@/lib/quiz/quizTagger";

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { db } = await connectToDatabase();
    const userId = session.user.email;

    // Get all unique tags with their types for this user
    const tagDocs = await db.collection("quiztags")
      .aggregate([
        { $match: { userId: userId } },
        { $unwind: "$tags" },
        {
          $group: {
            _id: { value: "$tags.value", type: "$tags.type" },
            count: { $sum: 1 }
          }
        },
        {
          $project: {
            value: "$_id.value",
            type: "$_id.type",
            count: 1,
            _id: 0
          }
        }
      ])
      .toArray();

    // Filter out null, undefined, or empty tags
    const filteredTags = tagDocs.filter((tag: any): tag is QuizTag =>
      tag.value !== null &&
      tag.value !== undefined &&
      tag.value !== "" &&
      typeof tag.value === "string"
    );

    return NextResponse.json(filteredTags);
  } catch (error) {
    console.error("Error fetching user tags:", error);
    return NextResponse.json(
      { error: "Failed to fetch user tags" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { db } = await connectToDatabase();
    const userId = session.user.email;

    // Get all unique tags with their types for this user
    const tagDocs = await db.collection("quiztags")
      .aggregate([
        { $match: { userId: userId } },
        { $unwind: "$tags" },
        {
          $group: {
            _id: { value: "$tags.value", type: "$tags.type" },
            count: { $sum: 1 }
          }
        },
        {
          $project: {
            value: "$_id.value",
            type: "$_id.type",
            count: 1,
            _id: 0
          }
        }
      ])
      .toArray();

    // Filter out null, undefined, or empty tags
    const filteredTags = tagDocs.filter((tag: any): tag is QuizTag =>
      tag.value !== null &&
      tag.value !== undefined &&
      tag.value !== "" &&
      typeof tag.value === "string"
    );

    return NextResponse.json(filteredTags);
  } catch (error) {
    console.error("Error fetching user tags:", error);
    return NextResponse.json(
      { error: "Failed to fetch user tags" },
      { status: 500 },
    );
  }
}