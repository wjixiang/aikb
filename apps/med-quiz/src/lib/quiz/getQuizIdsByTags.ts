import { ObjectId } from "mongodb";
import { connectToDatabase } from "../db/mongodb";
import { TagType } from "./quizTagger";

export interface TagFilterOptions {
  value: string;
  type?: TagType; // Optional tag type filter
}

/**
 * Get quiz IDs that match specified tags for a user
 * @param tags Array of tag values to filter by (strings or TagFilterOptions)
 * @param userId User email
 * @param filterMode "AND" for all tags must match, "OR" for any tag must match
 * @returns Array of quiz IDs
 */
export async function getQuizIdsByTags(
  tags: (string | TagFilterOptions)[], 
  userId: string, 
  filterMode: "AND" | "OR" = "AND"
): Promise<ObjectId[]> {
  if (!tags || tags.length === 0) {
    return [];
  }

  const { db } = await connectToDatabase();
  
  // Convert all tags to TagFilterOptions format for consistent processing
  const tagFilters: TagFilterOptions[] = tags.map(tag => 
    typeof tag === 'string' ? { value: tag } : tag
  );
  
  // Extract just the tag values for backward compatibility
  const tagValues = tagFilters.map(tag => tag.value);
  
  // 添加调试日志
  console.log(`[DEBUG] getQuizIdsByTags: tags=${JSON.stringify(tagFilters)}, userId=${userId}, filterMode=${filterMode}`);

  if (filterMode === "AND") {
    // AND mode: quiz must contain all specified tags
    const pipeline = [
      { $match: { userId, "tags.value": { $in: tagValues } } },
      { $project: {
        quizId: 1,
        tags: 1,
        hasAllTags: {
          $setIsSubset: [tagValues, "$tags.value"]
        }
      }},
      { $match: { hasAllTags: true } },
      { $group: { _id: "$quizId" } }
    ];
    
    const results = await db.collection("quiztags")
      .aggregate(pipeline)
      .toArray();
    
    // If tag types are specified, filter results by tag types
    let filteredResults = results;
    const hasTypeFilters = tagFilters.some(tag => tag.type);
    
    if (hasTypeFilters) {
      // Get full tag documents for type filtering
      const quizIds = results.map(r => new ObjectId(r._id));
      const tagDocs = await db.collection("quiztags")
        .find({ userId, quizId: { $in: quizIds } })
        .toArray();
      
      filteredResults = results.filter(result => {
        const quizId = new ObjectId(result._id);
        const quizTagDoc = tagDocs.find(doc => doc.quizId.equals(quizId));
        
        if (!quizTagDoc?.tags) return false;
        
        // Check if all tag filters match with type constraints
        return tagFilters.every(tagFilter => {
          const matchingTag = quizTagDoc.tags.find((t: any) => 
            t.value === tagFilter.value && 
            (!tagFilter.type || t.type === tagFilter.type)
          );
          return !!matchingTag;
        });
      });
    }
    
    console.log(`[DEBUG] AND mode results: ${JSON.stringify(filteredResults)}`);
    return filteredResults.map(r => new ObjectId(r._id));
  } else {
    // OR mode: quiz contains any of the specified tags
    let query: any = {
      userId,
      "tags.value": { $in: tagValues }
    };
    
    // If tag types are specified, add type filtering
    const typeFilters = tagFilters.filter(tag => tag.type);
    if (typeFilters.length > 0) {
      query.$or = typeFilters.map(tagFilter => ({
        "tags.value": tagFilter.value,
        "tags.type": tagFilter.type
      }));
      
      // Also include tags without type filtering for backward compatibility
      const nonTypeFilters = tagFilters.filter(tag => !tag.type);
      if (nonTypeFilters.length > 0) {
        query.$or.push({
          "tags.value": { $in: nonTypeFilters.map(tag => tag.value) }
        });
      }
    }
    
    const quizIds = await db.collection("quiztags")
      .distinct("quizId", query);
    
    console.log(`[DEBUG] OR mode quizIds: ${JSON.stringify(quizIds)}`);
    return quizIds.map(id => new ObjectId(id));
  }
}

/**
 * Get quiz IDs that do NOT match specified tags for a user
 * @param tags Array of tag values to exclude (strings or TagFilterOptions)
 * @param userId User email
 * @param filterMode "AND" for exclude all tags, "OR" for exclude any tag
 * @returns Array of quiz IDs to exclude
 */
export async function getQuizIdsToExcludeByTags(
  tags: (string | TagFilterOptions)[],
  userId: string,
  filterMode: "AND" | "OR" = "AND"
): Promise<ObjectId[]> {
  if (!tags || tags.length === 0) {
    return [];
  }

  const { db } = await connectToDatabase();
  
  // Convert all tags to TagFilterOptions format for consistent processing
  const tagFilters: TagFilterOptions[] = tags.map(tag => 
    typeof tag === 'string' ? { value: tag } : tag
  );
  
  // Extract just the tag values for backward compatibility
  const tagValues = tagFilters.map(tag => tag.value);
  
  // 添加调试日志
  console.log(`[DEBUG] getQuizIdsToExcludeByTags: tags=${JSON.stringify(tagFilters)}, userId=${userId}, filterMode=${filterMode}`);

  if (filterMode === "AND") {
    // AND mode: exclude quizzes that contain ALL specified tags
    const pipeline = [
      { $match: { userId, "tags.value": { $in: tagValues } } },
      { $project: {
        quizId: 1,
        tags: 1,
        hasAllTags: {
          $setIsSubset: [tagValues, "$tags.value"]
        }
      }},
      { $match: { hasAllTags: true } },
      { $group: { _id: "$quizId" } }
    ];
    
    const results = await db.collection("quiztags")
      .aggregate(pipeline)
      .toArray();
    
    // If tag types are specified, filter results by tag types
    let filteredResults = results;
    const hasTypeFilters = tagFilters.some(tag => tag.type);
    
    if (hasTypeFilters) {
      // Get full tag documents for type filtering
      const quizIds = results.map(r => new ObjectId(r._id));
      const tagDocs = await db.collection("quiztags")
        .find({ userId, quizId: { $in: quizIds } })
        .toArray();
      
      filteredResults = results.filter(result => {
        const quizId = new ObjectId(result._id);
        const quizTagDoc = tagDocs.find(doc => doc.quizId.equals(quizId));
        
        if (!quizTagDoc?.tags) return false;
        
        // Check if all tag filters match with type constraints
        return tagFilters.every(tagFilter => {
          const matchingTag = quizTagDoc.tags.find((t: any) => 
            t.value === tagFilter.value && 
            (!tagFilter.type || t.type === tagFilter.type)
          );
          return !!matchingTag;
        });
      });
    }
    
    console.log(`[DEBUG] Exclude AND mode results: ${JSON.stringify(filteredResults)}`);
    return filteredResults.map(r => new ObjectId(r._id));
  } else {
    // OR mode: exclude quizzes that contain ANY of the specified tags
    let query: any = {
      userId,
      "tags.value": { $in: tagValues }
    };
    
    // If tag types are specified, add type filtering
    const typeFilters = tagFilters.filter(tag => tag.type);
    if (typeFilters.length > 0) {
      query.$or = typeFilters.map(tagFilter => ({
        "tags.value": tagFilter.value,
        "tags.type": tagFilter.type
      }));
      
      // Also include tags without type filtering for backward compatibility
      const nonTypeFilters = tagFilters.filter(tag => !tag.type);
      if (nonTypeFilters.length > 0) {
        query.$or.push({
          "tags.value": { $in: nonTypeFilters.map(tag => tag.value) }
        });
      }
    }
    
    const quizIds = await db.collection("quiztags")
      .distinct("quizId", query);
    
    console.log(`[DEBUG] Exclude OR mode quizIds: ${JSON.stringify(quizIds)}`);
    return quizIds.map(id => new ObjectId(id));
  }
}