import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth/authOptions";
import bcrypt from "bcryptjs";
import { connectToDatabase } from "@/lib/db/mongodb";
import { ObjectId } from "mongodb";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ message: "未登录" }, { status: 401 });
  }

  try {
    const { currentPassword, newPassword } = await req.json();

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { message: "需要当前密码和新密码" },
        { status: 400 },
      );
    }

    const { db } = await connectToDatabase();

    const user = await db.collection("User").findOne(
      { email: session.user.email },
      // { projection: { password: 1 } }
    );

    console.log(session.user, user);

    if (!user) {
      return NextResponse.json({ message: "用户不存在" }, { status: 404 });
    }

    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      return NextResponse.json({ message: "当前密码不正确" }, { status: 401 });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await db
      .collection("users")
      .updateOne(
        { _id: new ObjectId(session.user.id) },
        { $set: { password: hashedPassword } },
      );

    return NextResponse.json({ message: "密码修改成功" });
  } catch (err) {
    console.error("密码修改错误:", err);
    return NextResponse.json(
      { message: "服务器错误，请稍后再试" },
      { status: 500 },
    );
  }
}
