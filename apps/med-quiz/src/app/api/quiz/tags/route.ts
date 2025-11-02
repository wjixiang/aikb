import { NextResponse } from "next/server";
import { connectToDatabase } from "../../../../lib/db/mongodb";

/**
 * Retrieves a list of unique tags from practice records with optional filtering.
 * This endpoint provides tag suggestions for autocomplete functionality.
 *
 * @param request - The incoming HTTP request object with query parameters
 * @returns A JSON response containing an array of unique tags or an error message
 *
 * @queryParam {string} [q] - Optional. Query string to filter tags by (case-insensitive)
 *
 * @example
 * // GET /api/quiz/tags?q=anatomy
 * // Response: ["anatomy", "anatomy-advanced", "clinical-anatomy"]
 *
 * @example
 * // GET /api/quiz/tags
 * // Response: ["anatomy", "physiology", "biochemistry", "pharmacology"]
 *
 * @throws {500} When there's a server error during database operations
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q')?.toLowerCase() || '';
    
    const { db } = await connectToDatabase();
    const allTags = await db.collection("practicerecords").distinct("tags");
    
    // Filter tags based on query if provided
    const filteredTags = allTags.filter((tag: any) => {
      if (!tag || tag === null || tag === undefined || tag === "") return false;
      return tag.toLowerCase().includes(query);
    });
    
    // Return limited number of suggestions (max 10)
    return NextResponse.json(filteredTags.slice(0, 10));
  } catch (error) {
    console.error("Error fetching unique tags:", error);
    return NextResponse.json(
      { error: "Failed to fetch unique tags" },
      { status: 500 },
    );
  }
}
