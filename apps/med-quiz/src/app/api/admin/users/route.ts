import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongodb";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/authOptions";
import { ObjectId } from "mongodb";
import { requireAdmin } from "@/lib/auth/middleware";

// 用户信息接口
interface UserInfo {
  _id: string;
  email: string;
  name?: string;
  role: string;
  createdAt: Date;
  updatedAt: Date;
  lastLogin?: Date;
}

// GET /api/admin/users - 获取所有用户列表（需要管理员权限）
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const adminError = requireAdmin(session);
    if (adminError) return adminError;

    const { db } = await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search');
    const role = searchParams.get('role');

    // 构建查询条件
    const query: any = {};
    
    if (search) {
      query.$or = [
        { email: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (role && role !== 'all') {
      query.role = role;
    }

    // 获取用户总数
    const totalUsers = await db.collection("users").countDocuments(query);
    
    // 获取分页用户列表
    const users = await db.collection("users")
      .find(query)
      .project({ 
        email: 1, 
        name: 1, 
        role: 1, 
        createdAt: 1, 
        updatedAt: 1,
        lastLogin: 1,
        password: 0 // 排除密码字段
      })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray();

    return NextResponse.json({
      users,
      pagination: {
        page,
        limit,
        total: totalUsers,
        pages: Math.ceil(totalUsers / limit)
      }
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}

// PUT /api/admin/users/[userId]/role - 更新用户角色（需要管理员权限）
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;
  try {
    const session = await getServerSession(authOptions);
    const adminError = requireAdmin(session);
    if (adminError) return adminError;

    const { db } = await connectToDatabase();
    const { role } = await request.json();

    // 验证角色值
    const validRoles = ['user', 'editor', 'admin'];
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { error: "Invalid role. Must be one of: user, editor, admin" },
        { status: 400 }
      );
    }

    // 验证用户ID
    if (!ObjectId.isValid(userId)) {
      return NextResponse.json(
        { error: "Invalid user ID" },
        { status: 400 }
      );
    }

    // 检查用户是否存在
    const existingUser = await db.collection("users").findOne({
      _id: new ObjectId(userId)
    });

    if (!existingUser) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // 不能修改自己的角色（防止管理员意外降级自己）
    if (existingUser.email === session!.user.email) {
      return NextResponse.json(
        { error: "Cannot modify your own role" },
        { status: 400 }
      );
    }

    // 更新用户角色
    const result = await db.collection("users").updateOne(
      { _id: new ObjectId(userId) },
      { 
        $set: { 
          role,
          updatedAt: new Date()
        } 
      }
    );

    if (result.modifiedCount === 0) {
      return NextResponse.json(
        { error: "Failed to update user role" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "User role updated successfully"
    });
  } catch (error) {
    console.error("Error updating user role:", error);
    return NextResponse.json(
      { error: "Failed to update user role" },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/users/[userId] - 删除用户（需要管理员权限）
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;
  try {
    const session = await getServerSession(authOptions);
    const adminError = requireAdmin(session);
    if (adminError) return adminError;

    const { db } = await connectToDatabase();

    // 验证用户ID
    if (!ObjectId.isValid(userId)) {
      return NextResponse.json(
        { error: "Invalid user ID" },
        { status: 400 }
      );
    }

    // 检查用户是否存在
    const existingUser = await db.collection("users").findOne({
      _id: new ObjectId(userId)
    });

    if (!existingUser) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // 不能删除自己
    if (existingUser.email === session!.user.email) {
      return NextResponse.json(
        { error: "Cannot delete your own account" },
        { status: 400 }
      );
    }

    // 删除用户
    const result = await db.collection("users").deleteOne({
      _id: new ObjectId(userId)
    });

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { error: "Failed to delete user" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "User deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting user:", error);
    return NextResponse.json(
      { error: "Failed to delete user" },
      { status: 500 }
    );
  }
}