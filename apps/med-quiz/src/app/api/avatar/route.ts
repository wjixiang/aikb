import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth/authOptions";
import { connectToDatabase } from "@/lib/db/mongodb";
import { v4 as uuidv4 } from "uuid";
import { writeFile } from "fs/promises";
import path from "path";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const data = await request.formData();
  const file: File | null = data.get("file") as unknown as File;

  if (!file) {
    return NextResponse.json({ error: "未选择文件" }, { status: 400 });
  }

  // 验证文件大小（最大4MB）
  const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4MB
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "文件大小超过4MB限制" }, { status: 400 });
  }

  try {
    // 生成唯一文件名
    const extension = path.extname(file.name);
    const filename = `${uuidv4()}${extension}`;
    const uploadPath = path.join(process.cwd(), "public/avatars", filename);

    // 将文件写入public目录
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(uploadPath, buffer);

    // 更新数据库中的avatar字段
    const { db } = await connectToDatabase();
    await db
      .collection("User")
      .updateOne(
        { email: session.user?.email },
        { $set: { avatar: `/avatars/${filename}` } },
      );

    return NextResponse.json({
      success: true,
      avatarUrl: `/avatars/${filename}`,
    });
  } catch (error) {
    console.error("头像上传失败:", error);
    return NextResponse.json(
      { error: "文件上传失败，请稍后再试" },
      { status: 500 },
    );
  }
}
