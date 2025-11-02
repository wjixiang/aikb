// src/app/api/note/add/route.ts
import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongodb";
import { note } from "@/types/noteData.types";

export async function POST(req: Request) {
  const body = await req.json(); // 解析请求体
  console.log(body);
  const { oid, fileName, metaData, content }: note = body.reqestData;

  if (!oid || !fileName || !content) {
    return NextResponse.json(
      { message: "Missing required fields" },
      { status: 400 },
    );
  }

  try {
    const { client, db } = await connectToDatabase();
    const collection = db.collection("note"); // 替换为您的集合名称

    // 检查 oid 是否存在
    const existingNote = await collection.findOne({ oid });
    if (existingNote) {
      return NextResponse.json(
        { message: "Note with this oid already exists" },
        { status: 409 },
      );
    }

    // 插入新文档
    const newNote = { oid, fileName, metaData, content };
    await collection.insertOne(newNote);

    return NextResponse.json(
      { message: "Note uploaded successfully", newNote },
      { status: 201 },
    );
  } catch (error) {
    console.error("Error uploading note:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}
