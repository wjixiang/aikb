import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongodb";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/authOptions";
import { requireAdmin } from "@/lib/auth/middleware";
import { PublicTag } from "@/types/quizSelector.types";
import { ObjectId } from "mongodb";

// GET /api/tags/public - 获取所有公共标签
export async function GET(request: Request) {
  try {
    const { db } = await connectToDatabase();
    
    // 获取查询参数
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const includeInactive = searchParams.get('includeInactive') === 'true';
    
    // 构建查询条件
    const query: any = {};
    
    if (category && category !== 'all') {
      query.category = category;
    }
    
    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }
    
    if (!includeInactive) {
      query.isActive = true;
    }
    
    // 获取所有公共标签，按使用次数降序排序
    const publicTags = await db.collection("publictags")
      .find(query)
      .sort({ usageCount: -1, name: 1 })
      .toArray();
    
    return NextResponse.json(publicTags);
  } catch (error) {
    console.error("Error fetching public tags:", error);
    return NextResponse.json(
      { error: "Failed to fetch public tags" },
      { status: 500 }
    );
  }
}

// POST /api/tags/public - 创建新公共标签（需要管理员权限）
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    // 使用新的权限验证工具
    const adminError = requireAdmin(session);
    if (adminError) return adminError;
    
    const { db } = await connectToDatabase();
    const tagData = await request.json();
    
    // 验证必填字段
    if (!tagData.name || !tagData.name.trim()) {
      return NextResponse.json(
        { error: "Tag name is required" },
        { status: 400 }
      );
    }
    
    // 检查标签是否已存在
    const existingTag = await db.collection("publictags").findOne({
      name: tagData.name.trim()
    });
    
    if (existingTag) {
      return NextResponse.json(
        { error: "Tag with this name already exists" },
        { status: 409 }
      );
    }
    
    const now = new Date();
    const newTag: PublicTag = {
      name: tagData.name.trim(),
      description: tagData.description?.trim(),
      category: tagData.category?.trim(),
      color: tagData.color,
      usageCount: 0,
      createdBy: session!.user.email || "system",
      createdAt: now,
      updatedAt: now,
      isActive: true
    };
    
    const result = await db.collection("publictags").insertOne(newTag);
    
    if (!result.insertedId) {
      return NextResponse.json(
        { error: "Failed to create public tag" },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: "Public tag created successfully",
      tagId: result.insertedId
    });
  } catch (error) {
    console.error("Error creating public tag:", error);
    return NextResponse.json(
      { error: "Failed to create public tag" },
      { status: 500 }
    );
  }
}