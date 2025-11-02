import { NextRequest, NextResponse } from "next/server";
import { quizSelector } from "@/types/quizSelector.types";
import { connectToDatabase } from "@/lib/db/mongodb";

function corsHeaders(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

/**
 * Handles CORS preflight requests
 * @returns {NextResponse} Response with CORS headers
 */
export async function OPTIONS() {
  return NextResponse.json(
    {},
    {
      headers: corsHeaders(null),
    },
  );
}

function getRandomElements(arr: any[], num: number) {
  if (num > arr.length) {
    return [];
  }

  const shuffled = arr.sort(() => 0.5 - Math.random());
  return shuffled.slice(0, num);
}

const getUniqueUnitCount = async (selector: quizSelector) => {
  const { db } = await connectToDatabase();

  try {
    const results = await db.collection("quiz").distinct("unit");

    return results;
  } catch (error) {
    console.error("Error fetching unique unit count:", error);
    throw error; // 处理错误
  }
};

/**
 * Processes POST request to fetch unique unit values from quiz collection
 * @param {NextRequest} request - The incoming request object
 * @returns {Promise<NextResponse>} JSON response with unique units or error message
 * @throws {Error} If database connection or query fails
 * @description
 * - Handles CORS headers
 * - Connects to MongoDB database
 * - Retrieves distinct 'unit' values from quiz collection
 * - Returns list of units with proper CORS headers
 */
export async function POST(request: NextRequest) {
  const headers = corsHeaders(null);

  try {
    await request.json();
    const { db } = await connectToDatabase();
    const unit = await db.collection("quiz").distinct("unit");
    // console.log(unit)

    // 返回查询结果
    return NextResponse.json(unit, {
      status: 200,
      headers: headers,
    });
  } catch (error) {
    console.error("Quiz fetch error:", error);
    return new NextResponse(
      JSON.stringify({ error: "Failed to fetch quizzes" }),
      {
        status: 500,
        headers: headers,
      },
    );
  }
}
