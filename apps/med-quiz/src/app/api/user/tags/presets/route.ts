import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongodb";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/authOptions";
import { TagPreset } from "@/types/quizSelector.types";
import { ObjectId } from "mongodb";

// 获取用户的标签预设列表
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { db } = await connectToDatabase();
    const userId = session.user.email;

    // 获取用户的所有预设，包括默认预设
    const presets = await db.collection("tagpresets").find({
      $or: [
        { userId },
        { isDefault: true }
      ]
    }).sort({ isDefault: 1, name: 1 }).toArray();

    return NextResponse.json(presets);
  } catch (error) {
    console.error("Error fetching tag presets:", error);
    return NextResponse.json(
      { error: "Failed to fetch tag presets" },
      { status: 500 }
    );
  }
}

// 创建或更新标签预设
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { db } = await connectToDatabase();
    const userId = session.user.email;
    const presetData: Omit<TagPreset, "_id" | "userId" | "createdAt" | "updatedAt"> = await request.json();

    if (!presetData.name) {
      return NextResponse.json(
        { error: "Preset name is required" },
        { status: 400 }
      );
    }

    const now = new Date();
    
    // 检查是否已存在同名预设
    const existingPreset = await db.collection("tagpresets").findOne({
      userId,
      name: presetData.name
    });

    if (existingPreset) {
      // 更新现有预设
      const result = await db.collection("tagpresets").updateOne(
        { _id: existingPreset._id, userId },
        {
          $set: {
            ...presetData,
            updatedAt: now
          }
        }
      );

      if (result.modifiedCount === 0) {
        return NextResponse.json(
          { error: "Failed to update preset" },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true, message: "Preset updated successfully" });
    } else {
      // 创建新预设
      const newPreset: TagPreset = {
        ...presetData,
        userId,
        createdAt: now,
        updatedAt: now,
        isDefault: false
      };

      const result = await db.collection("tagpresets").insertOne(newPreset);

      if (!result.insertedId) {
        return NextResponse.json(
          { error: "Failed to create preset" },
          { status: 500 }
        );
      }

      return NextResponse.json({ 
        success: true, 
        message: "Preset created successfully",
        presetId: result.insertedId 
      });
    }
  } catch (error) {
    console.error("Error saving tag preset:", error);
    return NextResponse.json(
      { error: "Failed to save tag preset" },
      { status: 500 }
    );
  }
}

// 删除标签预设
export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { db } = await connectToDatabase();
    const userId = session.user.email;
    const { searchParams } = new URL(request.url);
    const presetId = searchParams.get("id");

    if (!presetId) {
      return NextResponse.json(
        { error: "Preset ID is required" },
        { status: 400 }
      );
    }

    // 只能删除用户自己的预设，不能删除默认预设
    const result = await db.collection("tagpresets").deleteOne({
      _id: new ObjectId(presetId),
      userId,
      isDefault: { $ne: true }
    });

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { error: "Preset not found or cannot be deleted" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, message: "Preset deleted successfully" });
  } catch (error) {
    console.error("Error deleting tag preset:", error);
    return NextResponse.json(
      { error: "Failed to delete tag preset" },
      { status: 500 }
    );
  }
}