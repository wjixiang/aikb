import { connectToDatabase } from "@/lib/db/mongodb";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/authOptions";
import { ObjectId } from "mongodb";
import { quiz, answerType } from "@/types/quizData.types";
import { QuizSetDocument, QuizSetData, APIResponse, QuizSetItem } from "@/types/quizSet.types";

/**
 * Retrieves a specific quiz set with all its quizzes and answers for the authenticated user.
 *
 * @param request - The incoming HTTP request object
 * @param params - Route parameters containing the quiz set ID
 * @returns A JSON response containing the quiz set data or an error message
 *
 * @example
 * // GET /api/quiz/create/507f1f77bcf86cd799439011
 * // Response: { "success": true, "data": { "id": "507f1f77bcf86cd799439011", "title": "Anatomy Quiz", "quizzes": [...], "createdAt": "2023-01-01" } }
 *
 * @throws {401} When user is not authenticated
 * @throws {400} When quiz set ID is invalid
 * @throws {404} When quiz set is not found or not owned by the user
 * @throws {500} When there's a server error during database operations
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { db } = await connectToDatabase();
    const quizSetId = (await params).id;

    if (!ObjectId.isValid(quizSetId)) {
      return NextResponse.json(
        { error: "Invalid quiz set ID" },
        { status: 400 },
      );
    }

    const quizSet = await db.collection("quizSets").findOne({
      _id: new ObjectId(quizSetId),
      creator: session.user.email,
    });

    if (!quizSet) {
      return NextResponse.json(
        { error: "Quiz set not found" },
        { status: 404 },
      );
    }

    // Validate all quiz IDs before querying
    const validQuizIds = quizSet.quizzes
      .filter((q: QuizSetItem) => ObjectId.isValid(q.quizId))
      .map((q: QuizSetItem) => new ObjectId(q.quizId));

    if (validQuizIds.length !== quizSet.quizzes.length) {
      console.warn(
        "Some quiz IDs are invalid:",
        quizSet.quizzes
          .filter((q: QuizSetItem) => !ObjectId.isValid(q.quizId))
          .map((q: QuizSetItem) => q.quizId),
      );
    }

    // Get quizzes with valid IDs only
    const foundQuizzes = await db
      .collection("quiz")
      .find({
        _id: { $in: validQuizIds },
      })
      .toArray();

    // console.log("foundQuizzes", foundQuizzes)

    // // Validate all quiz IDs before querying
    // const validQuizIds = quizSet.quizzes
    //   .filter((q: QuizSetItem) => ObjectId.isValid(q.quizId))
    //   .map((q: QuizSetItem) => new ObjectId(q.quizId));

    // if (validQuizIds.length !== quizSet.quizzes.length) {
    //   console.warn('Some quiz IDs are invalid:',
    //     quizSet.quizzes
    //       .filter((q: QuizSetItem) => !ObjectId.isValid(q.quizId))
    //       .map((q: QuizSetItem) => q.quizId));
    // }

    // // Get quizzes with valid IDs only
    // const foundQuizzes = await db.collection("quiz").find({
    //   _id: { $in: validQuizIds }
    // }).toArray();

    // Map quiz data to match frontend expected structure
    const quizData = quizSet.quizzes
      .filter((q: QuizSetItem) => ObjectId.isValid(q.quizId))
      .map((q: QuizSetItem) => {
        const quiz = foundQuizzes.find((quiz) =>
          quiz._id.equals(new ObjectId(q.quizId)),
        );
        if (!quiz) {
          console.warn(`Quiz ${q.quizId} not found in database`);
          return null;
        }
        return {
          quiz: {
            ...quiz,
            _id: quiz._id.toString(),
          },
          answer: q.answer || null,
        };
      })
      .filter(Boolean); // Remove null entries

    return NextResponse.json<APIResponse<QuizSetData>>({
      success: true,
      data: {
        id: quizSet._id.toString(),
        title: quizSet.title,
        quizzes: quizData,
        createdAt: quizSet.createdAt,
      },
    });
  } catch (error) {
    console.error("Error fetching quiz set:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
