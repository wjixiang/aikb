import { connectToDatabase } from "@/lib/db/mongodb";
import { NextRequest, NextResponse } from "next/server";
import { isQuizType } from "./isQUizType";
import { ObjectId } from "mongodb";

/**
 * @swagger
 * /api/addQuiz:
 *   post:
 *     summary: Add a new quiz to the database
 *     description: |
 *       Validates and stores a new quiz in the database after checking for duplicates.
 *       Supports multiple quiz types (A1, A2, A3, B, X) with different validation rules.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             oneOf:
 *               - $ref: '#/components/schemas/QuizTypeA1A2X'
 *               - $ref: '#/components/schemas/QuizTypeA3'
 *               - $ref: '#/components/schemas/QuizTypeB'
 *     responses:
 *       200:
 *         description: Quiz successfully added
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MongoInsertResult'
 *       400:
 *         description: Invalid quiz data or duplicate content
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *
 * @example
 * // Example request for Type A1/A2/X quiz:
 * {
 *   "_id": "507f1f77bcf86cd799439011",
 *   "type": "A1",
 *   "question": "What is the capital of France?",
 *   "options": ["Paris", "London", "Berlin", "Madrid"],
 *   "answer": 0,
 *   "explanation": "Paris has been the capital of France since 508 AD",
 *   "subject": "Geography",
 *   "unit": "European Capitals"
 * }
 *
 * @example
 * // Example request for Type A3 quiz:
 * {
 *   "_id": "507f1f77bcf86cd799439012",
 *   "type": "A3",
 *   "mainQuestion": "Cardiovascular System",
 *   "subQuizs": [
 *     {
 *       "question": "Which chamber pumps oxygenated blood?",
 *       "options": ["Right atrium", "Left atrium", "Right ventricle", "Left ventricle"],
 *       "answer": 3
 *     },
 *     {
 *       "question": "Which valve prevents backflow to the left ventricle?",
 *       "options": ["Tricuspid", "Pulmonary", "Mitral", "Aortic"],
 *       "answer": 3
 *     }
 *   ],
 *   "subject": "Anatomy",
 *   "unit": "Cardiology"
 * }
 *
 * @example
 * // Example request for Type B quiz:
 * {
 *   "_id": "507f1f77bcf86cd799439013",
 *   "type": "B",
 *   "questions": [
 *     "What is the normal range for blood pressure?",
 *     "What condition does hypertension indicate?"
 *   ],
 *   "options": [
 *     ["90/60 - 120/80 mmHg", "130/90 - 140/90 mmHg", "150/100 - 160/110 mmHg"],
 *     ["Low blood pressure", "High blood pressure", "Irregular heartbeat"]
 *   ],
 *   "answers": [0, 1],
 *   "subject": "Physiology",
 *   "unit": "Circulatory System"
 * }
 */
export async function POST(request: NextRequest) {
  /**
   * 1. Justify the structure of quiz data
   * 2. Assure no duplication in db
   * 3. Push into db
   */

  try {
    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }

    const contentType = request.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      return new Response(JSON.stringify({ error: "Invalid content type" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    let quizData;
    try {
      quizData = await request.json();
    } catch (e) {
      return new Response(JSON.stringify({ error: "Invalid JSON format" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!isQuizType(quizData)) {
      return new Response(
        JSON.stringify({ error: "Invalid quiz data format" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const { db } = await connectToDatabase();
    const collection = db.collection("quiz");

    // Check for duplicate content based on quiz type
    let duplicateQuery = {};
    if (
      quizData.type === "A1" ||
      quizData.type === "A2" ||
      quizData.type === "X"
    ) {
      duplicateQuery = {
        question: quizData.question,
        options: { $eq: quizData.options },
      };
    } else if (quizData.type === "A3") {
      duplicateQuery = {
        mainQuestion: quizData.mainQuestion,
        subQuizs: { $eq: quizData.subQuizs },
      };
    } else if (quizData.type === "B") {
      duplicateQuery = {
        questions: { $eq: quizData.questions },
        options: { $eq: quizData.options },
      };
    }

    const existingByContent = await collection.findOne(duplicateQuery);
    if (existingByContent) {
      return NextResponse.json({
        state: "Failed",
        error: "Duplicate quiz content",
      });
    } else {
      const saveResult = await collection.insertOne({
        ...quizData,
        _id: new ObjectId(),
      });
      return NextResponse.json(saveResult);
    }
  } catch (error) {
    console.error(error);
    return NextResponse.json({
      state: "Failed",
      error: error,
    });
  }
}
