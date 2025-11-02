import { connectToDatabase } from "@/lib/db/mongodb";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/authOptions";
import { QuizSetDocument, CreateQuizSetRequest, APIResponse } from "@/types/quizSet.types";

/**
 * Creates a new quiz set with the specified title and quiz IDs.
 *
 * @param request - The incoming HTTP request object containing title and quizIds array
 * @returns A JSON response with the new quiz set ID or an error message
 *
 * @example
 * // POST /api/quiz/create
 * // Body: { "title": "Anatomy Quiz", "quizIds": ["507f1f77bcf86cd799439011", "507f1f77bcf86cd799439012"] }
 * // Response: { "success": true, "id": "507f1f77bcf86cd799439013" }
 *
 * @throws {401} When user is not authenticated
 * @throws {400} When request data is invalid (missing title or quizIds)
 * @throws {500} When there's a server error during database operations
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { title, quizIds } = await request.json();

    if (!title || !quizIds || !Array.isArray(quizIds)) {
      return NextResponse.json(
        { error: "Invalid request data" },
        { status: 400 },
      );
    }

    const { db } = await connectToDatabase();

    const quizSetData: Omit<QuizSetDocument, '_id'> = {
      title,
      quizzes: quizIds.map((id: string) => ({ quizId: id, answer: null })),
      createdAt: new Date(),
      creator: session.user.email,
    };

    const insertResult = await db.collection("quizSets").insertOne(quizSetData);

    return NextResponse.json<APIResponse>({
      success: true,
      id: insertResult.insertedId.toString(),
    });
  } catch (error) {
    console.error("Error saving quiz set:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
