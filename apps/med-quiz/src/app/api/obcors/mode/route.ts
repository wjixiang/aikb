import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const modes = ["A1", "A2", "A3", "X", "B"];
  return NextResponse.json(modes);
}
