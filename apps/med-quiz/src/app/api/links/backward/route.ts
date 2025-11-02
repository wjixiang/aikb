/**
 * API endpoint for retrieving backward links
 */

import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongodb";
import knowledgeBase from "@/kgrag/knowledgeBase";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const documentId =
      searchParams.get("documentId") || searchParams.get("path");

    if (!documentId) {
      return NextResponse.json(
        { error: "documentId or path parameter is required" },
        { status: 400 },
      );
    }

    const kdb = new knowledgeBase();

    // 查询 backward links
    // The documentId here is actually s3_key. need to be corrected in future.
    const forwardLinks = await kdb.getBackwardLinks(documentId);

    // 格式化返回数据
    const formattedLinks = forwardLinks.map((link) => ({
      sourceId: link.sourceId,
      targetId: link.targetId,
      sourceTitle:
        link.sourceTitle || link.sourceId.split("/").pop() || "Untitled",
      linkType: link.linkType,
      createdAt: link.createdAt,
      updatedAt: link.updatedAt,
    }));

    return NextResponse.json({
      documentId,
      links: formattedLinks,
      count: formattedLinks.length,
    });
  } catch (error) {
    console.error("Error retrieving backward links:", error);
    return NextResponse.json(
      {
        error: "Failed to retrieve backward links",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
