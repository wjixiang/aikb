import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongodb";
import { AnkiCollectionPreset } from "@/types/anki.types";

/**
 * 获取所有preset collections
 * @returns AnkiCollectionPreset[]
 */
export async function GET() {
  try {
    const { db } = await connectToDatabase();

    // 获取所有的预设牌组信息
    const preSets = await db.collection("presetCollections").find().toArray();

    return NextResponse.json(preSets);
  } catch (error) {
    console.error("Error in GET /api/fsrs/collections/preset:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
