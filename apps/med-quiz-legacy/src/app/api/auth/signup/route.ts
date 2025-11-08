import { NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
import { connectToDatabase } from '@/lib/db/mongodb';

export async function POST(request: Request) {
  try {
    const { name, email, password } = await request.json();

    // 验证输入
    if (!name || !email || !password) {
      return NextResponse.json({ message: '缺少必要信息' }, { status: 400 });
    }

    const { db } = await connectToDatabase();

    // 检查邮箱是否已存在
    const existingUser = await db.collection('users').findOne({
      email: email.toLowerCase().trim(),
    });

    if (existingUser) {
      return NextResponse.json({ message: '该邮箱已被注册' }, { status: 400 });
    }

    // 密码加密
    const hashedPassword = await hash(password, 10);

    // 创建用户文档
    const result = await db.collection('users').insertOne({
      name,
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      emailVerified: new Date(),
      image: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    console.log('注册成功用户:', email);

    return NextResponse.json(
      { message: '注册成功', userId: result.insertedId },
      { status: 201 },
    );
  } catch (error) {
    console.error('注册错误:', error);
    return NextResponse.json({ message: '服务器错误' }, { status: 500 });
  }
}
