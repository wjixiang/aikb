import { connectToDatabase } from "@/lib/db/mongodb";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/authOptions";
import { QuizHistoryItem, APIResponse } from "@/types/quizSet.types";

/**
 * Retrieves a paginated history of all quiz sets created by the authenticated user.
 *
 * @param request - The incoming HTTP request object
 * @returns A JSON response containing an array of quiz history items or an error message
 *
 * @example
 * // GET /api/quiz/page_history
 * // Response: { "success": true, "data": [{ "id": "507f1f77bcf86cd799439011", "title": "Anatomy Quiz", "createdAt": "2023-01-01", "quizCount": 10 }] }
 *
 * @throws {401} When user is not authenticated
 * @throws {500} When there's a server error during database operations
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { db } = await connectToDatabase();

    const quizSets = await db
      .collection("quizSets")
      .find({ creator: session.user.email })
      .sort({ createdAt: -1 })
      .project({
        _id: 1,
        title: 1,
        createdAt: 1,
        "quizzes.quiz._id": 1,
      })
      .toArray();

    const formattedQuizSets: QuizHistoryItem[] = quizSets.map((quizSet) => ({
      id: quizSet._id.toString(),
      title: quizSet.title,
      createdAt: quizSet.createdAt,
      quizCount: quizSet.quizzes?.length || 0,
    }));

    return NextResponse.json<APIResponse<QuizHistoryItem[]>>({
      success: true,
      data: formattedQuizSets,
    });
  } catch (error) {
    console.error("Error fetching quiz history:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
