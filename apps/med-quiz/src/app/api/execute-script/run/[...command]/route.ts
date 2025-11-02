import { testAllProviders } from "@/lib/langchain/provider";
import noteEmbedding from "@/lib/milvus/embedding/noteEmbedding";
import { QdrantClient } from "@qdrant/js-client-rest";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ [key: string]: string }> },
) {
  try {
    const requestBody = await request.json();
    const { scriptId } = requestBody;

    switch (scriptId) {
      // case "delete-qdrant-note-collection":
      //   const client = new QdrantClient({ host: "localhost", port: 6333 });
      //   const result = await client.deleteCollection("note");
      //   console.log("Qdrant note collection has been deleted", result);
      //   break;

      case "embed-all-note":
        const embed = new noteEmbedding();
        await embed.embedAllNotes();
        break;

      case "testAllProviders":
        testAllProviders();
        break;

      default:
        return NextResponse.json({ error: "Invalid command" }, { status: 400 });
    }

    return NextResponse.json({ message: "Command processed successfully" });
  } catch (error) {
    console.error("Error processing command:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
