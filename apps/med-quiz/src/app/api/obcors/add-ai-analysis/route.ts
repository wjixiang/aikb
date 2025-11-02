import { NextResponse, NextRequest } from "next/server";
import { MongoClient, ObjectId } from "mongodb";
import { connectToDatabase } from "@/lib/db/mongodb";

export async function POST(request: NextRequest) {
  try {
    const { id, ai_analysis } = await request.json();
    if (!id || !ai_analysis) {
      return NextResponse.json(
        { error: "Missing id or ai_analysis in request body" },
        { status: 400 },
      );
    }

    const { client, db } = await connectToDatabase();
    const collection = db.collection("a1"); //暂时使用a1集合用于测试

    const result = await collection.updateOne(
      { _id: new ObjectId(id) },
      { $push: { ai_analysis } },
    );

    if (result.modifiedCount === 0) {
      return NextResponse.json(
        { error: "Document not found or update failed" },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { message: "Record appended successfully" },
      { status: 200 },
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error.message || String(error),
      },
      { status: 500 },
    );
  }
}
