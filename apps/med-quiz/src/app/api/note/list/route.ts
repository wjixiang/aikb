import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongodb";
import type { note } from "@/types/noteData.types";

export async function GET(req: Request) {
  try {
    const { client, db } = await connectToDatabase();
    const collection = db.collection<note>("note");
    const notes = await collection.find({}).toArray();
    return NextResponse.json(notes, { status: 200 });
  } catch (error) {
    console.error("Error listing notes:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}
