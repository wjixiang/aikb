import { NextRequest, NextResponse } from 'next/server';

const scripts: Record<string, () => any> = {
  sayHello: () => 'Hello, World!',
  getTimestamp: () => `Current Timestamp: ${Date.now()}`,
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { scriptId } = body;

    if (!scriptId || !scripts[scriptId]) {
      return NextResponse.json({ error: '无效的脚本标识符' }, { status: 400 });
    }

    const result = scripts[scriptId]();
    return NextResponse.json({ result }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: '脚本执行失败' }, { status: 500 });
  }
}
