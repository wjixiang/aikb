import { NextRequest, NextResponse } from "next/server";
import { clientPromise } from "@/lib/db/mongodb";
import quizModal from "@/lib/db/quizModal";
import { quizSelector } from "@/types/quizSelector.types";
import { headers } from "next/headers";
import { connectToDatabase } from "@/lib/db/mongodb";

function corsHeaders(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

export async function OPTIONS() {
  return NextResponse.json(
    {},
    {
      headers: corsHeaders(null),
    },
  );
}

const getQuizSource = async (selector: quizSelector) => {
  try {
    const { db } = await connectToDatabase();
    return await db.collection("quiz").distinct("source");
  } catch (error) {
    console.error("Error fetching unique unit count:", error);
    throw error; // 处理错误
  }
};

export async function POST(request: NextRequest) {
  await clientPromise;

  const headers = corsHeaders(null);

  try {
    const body = await request.json();
    const selector: quizSelector = body.reqestData;

    const res = await getQuizSource(selector);

    // 返回查询结果
    return NextResponse.json(res, {
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
