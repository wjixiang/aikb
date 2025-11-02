// src/app/api/note/fetch/route.ts
import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongodb";
import { note } from "@/types/noteData.types";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const oid = searchParams.get("oid");
  const title = searchParams.get("title");

  if (oid) {
    try {
      const { client, db } = await connectToDatabase();
      const collection = db.collection<note>("note");
      const document = await collection.findOne({ oid });

      if (!document) {
        return NextResponse.json({ message: "No document found" });
      }

      return NextResponse.json(document, { status: 200 });
    } catch (error) {
      console.error("Error querying document:", error);
      return NextResponse.json(
        { message: "Internal server error" },
        { status: 500 },
      );
    }
  }

  if (title) {
    try {
      const { client, db } = await connectToDatabase();
      const collection = db.collection<note>("note");
      const document = await collection.findOne({ fileName: title });

      if (!document) {
        return NextResponse.json({ message: "No document found" });
      }

      return NextResponse.json(document, { status: 200 });
    } catch (error) {
      console.error("Error querying document:", error);
      return NextResponse.json(
        { message: "Internal server error" },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ message: "Missing oid" }, { status: 400 });
}
