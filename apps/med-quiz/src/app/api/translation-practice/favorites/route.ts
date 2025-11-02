import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongodb";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/authOptions";
import { ObjectId } from "mongodb";

export async function GET(request: NextRequest) {
  try {
    // Get user session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get("documentId");
    const sentenceIndex = searchParams.get("sentenceIndex");

    if (!documentId || sentenceIndex === null) {
      return NextResponse.json(
        { error: "Document ID and sentence index are required" },
        { status: 400 },
      );
    }

    // Connect to database
    const { db } = await connectToDatabase();

    // Check if sentence is favorited
    const favorite = await db.collection("translationFavorites").findOne({
      userId: new ObjectId(session.user.id),
      documentId: new ObjectId(documentId),
      sentenceIndex: parseInt(sentenceIndex),
    });

    return NextResponse.json({
      success: true,
      isFavorite: !!favorite,
    });
  } catch (error) {
    console.error("Error checking favorite status:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get user session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse request body
    const { documentId, sentenceIndex, sentence } = await request.json();

    if (!documentId || sentenceIndex === undefined || !sentence) {
      return NextResponse.json(
        {
          error: "Document ID, sentence index, and sentence text are required",
        },
        { status: 400 },
      );
    }

    // Connect to database
    const { db } = await connectToDatabase();

    // Check if already favorited
    const existingFavorite = await db
      .collection("translationFavorites")
      .findOne({
        userId: new ObjectId(session.user.id),
        documentId: new ObjectId(documentId),
        sentenceIndex: sentenceIndex,
      });

    if (existingFavorite) {
      // Remove from favorites
      await db.collection("translationFavorites").deleteOne({
        userId: new ObjectId(session.user.id),
        documentId: new ObjectId(documentId),
        sentenceIndex: sentenceIndex,
      });

      return NextResponse.json({
        success: true,
        message: "Removed from favorites",
      });
    } else {
      // Add to favorites
      const favoriteDoc = {
        userId: new ObjectId(session.user.id),
        documentId: new ObjectId(documentId),
        sentenceIndex: sentenceIndex,
        sentence: sentence,
        createdAt: new Date(),
      };

      await db.collection("translationFavorites").insertOne(favoriteDoc);

      return NextResponse.json({
        success: true,
        message: "Added to favorites",
      });
    }
  } catch (error) {
    console.error("Error toggling favorite:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Get user session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse request body
    const { documentId, sentenceIndex } = await request.json();

    if (!documentId || sentenceIndex === undefined) {
      return NextResponse.json(
        { error: "Document ID and sentence index are required" },
        { status: 400 },
      );
    }

    // Connect to database
    const { db } = await connectToDatabase();

    // Remove from favorites
    const result = await db.collection("translationFavorites").deleteOne({
      userId: new ObjectId(session.user.id),
      documentId: new ObjectId(documentId),
      sentenceIndex: sentenceIndex,
    });

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { error: "Favorite not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Removed from favorites",
    });
  } catch (error) {
    console.error("Error removing favorite:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
