import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongodb";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/authOptions";

// GET /api/tags/stats - 获取标签使用统计信息
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // 只有管理员可以查看详细统计
    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }
    
    const { db } = await connectToDatabase();
    
    // 获取最常用的标签
    const mostUsedTags = await db.collection("publictags")
      .find({ isActive: true })
      .sort({ usageCount: -1 })
      .limit(20)
      .toArray();
    
    // 获取最近使用的标签
    const recentlyUsedTags = await db.collection("publictags")
      .find({ isActive: true, lastUsed: { $exists: true } })
      .sort({ lastUsed: -1 })
      .limit(20)
      .toArray();
    
    // 获取按分类统计
    const categoryStats = await db.collection("publictags")
      .aggregate([
        { $match: { isActive: true, category: { $exists: true, $ne: "" } } },
        { $group: { 
          _id: "$category", 
          tagCount: { $sum: 1 },
          totalUsage: { $sum: "$usageCount" },
          avgUsage: { $avg: "$usageCount" }
        }},
        { $sort: { totalUsage: -1 } }
      ])
      .toArray();
    
    // 获取活跃标签总数
    const activeTagsCount = await db.collection("publictags")
      .countDocuments({ isActive: true });
    
    // 获取总使用次数
    const totalUsageResult = await db.collection("publictags")
      .aggregate([
        { $match: { isActive: true } },
        { $group: { _id: null, totalUsage: { $sum: "$usageCount" } } }
      ])
      .toArray();
    
    const totalUsage = totalUsageResult[0]?.totalUsage || 0;
    
    // 获取创建时间分布
    const creationStats = await db.collection("publictags")
      .aggregate([
        { $match: { isActive: true } },
        { $group: { 
          _id: { 
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" }
          },
          count: { $sum: 1 }
        }},
        { $sort: { "_id.year": -1, "_id.month": -1 } },
        { $limit: 12 }
      ])
      .toArray();
    
    return NextResponse.json({
      summary: {
        activeTagsCount,
        totalUsage,
        averageUsagePerTag: activeTagsCount > 0 ? totalUsage / activeTagsCount : 0
      },
      mostUsedTags,
      recentlyUsedTags,
      categoryStats,
      creationStats
    });
  } catch (error) {
    console.error("Error fetching tag statistics:", error);
    return NextResponse.json(
      { error: "Failed to fetch tag statistics" },
      { status: 500 }
    );
  }
}
