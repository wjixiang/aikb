/**
 * API endpoint for retrieving link statistics
 */

import { NextResponse } from "next/server";
import { LinkStatsService } from "@/kgrag/services/linkStatsService";

const statsService = new LinkStatsService();

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const includeActivity = searchParams.get("includeActivity") === "true";
    const days = parseInt(searchParams.get("days") || "30", 10);

    const stats = await statsService.getLinkStats();

    let activity = null;
    if (includeActivity) {
      activity = await statsService.getLinkActivity(days);
    }

    return NextResponse.json({
      ...stats,
      activity: includeActivity ? activity : undefined,
    });
  } catch (error) {
    console.error("Error retrieving link stats:", error);
    return NextResponse.json(
      { error: "Failed to retrieve link statistics" },
      { status: 500 },
    );
  }
}
