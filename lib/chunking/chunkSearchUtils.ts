import { BookChunk, ChunkSearchFilter } from '../../knowledgeBase/knowledgeImport/library';

/**
 * Utility class for advanced chunk search filtering and sorting
 */
export class ChunkSearchUtils {
  /**
   * Filter chunks by multiple criteria with priority ordering
   */
  static filterChunks(
    chunks: BookChunk[],
    filter: ChunkSearchFilter
  ): BookChunk[] {
    let filteredChunks = [...chunks];

    // Apply text search filter
    if (filter.query) {
      const queryLower = filter.query.toLowerCase();
      filteredChunks = filteredChunks.filter(chunk =>
        chunk.title.toLowerCase().includes(queryLower) ||
        chunk.content.toLowerCase().includes(queryLower)
      );
    }

    // Apply item ID filter
    if (filter.itemId) {
      filteredChunks = filteredChunks.filter(chunk => chunk.itemId === filter.itemId);
    }

    // Apply item IDs filter
    if (filter.itemIds && filter.itemIds.length > 0) {
      filteredChunks = filteredChunks.filter(chunk => filter.itemIds!.includes(chunk.itemId));
    }

    // Apply group filter
    if (filter.denseVectorIndexGroup) {
      filteredChunks = filteredChunks.filter(chunk => chunk.denseVectorIndexGroup === filter.denseVectorIndexGroup);
    }

    // Apply groups filter
    if (filter.groups && filter.groups.length > 0) {
      filteredChunks = filteredChunks.filter(chunk => filter.groups!.includes(chunk.denseVectorIndexGroup));
    }

    // Apply version filter
    if (filter.version) {
      filteredChunks = filteredChunks.filter(chunk => chunk.version === filter.version);
    }

    // Apply versions filter
    if (filter.versions && filter.versions.length > 0) {
      filteredChunks = filteredChunks.filter(chunk => filter.versions!.includes(chunk.version));
    }

    // Apply chunking strategies filter
    if (filter.chunkingStrategies && filter.chunkingStrategies.length > 0) {
      filteredChunks = filteredChunks.filter(chunk => 
        filter.chunkingStrategies!.includes(chunk.strategyMetadata.chunkingStrategy)
      );
    }

    // Apply embedding providers filter
    if (filter.embeddingProviders && filter.embeddingProviders.length > 0) {
      filteredChunks = filteredChunks.filter(chunk => 
        filter.embeddingProviders!.includes(chunk.strategyMetadata.embeddingProvider)
      );
    }

    // Apply date range filter
    if (filter.dateRange) {
      const { start, end } = filter.dateRange;
      filteredChunks = filteredChunks.filter(chunk => {
        const chunkDate = new Date(chunk.createdAt);
        return chunkDate >= start && chunkDate <= end;
      });
    }

    return filteredChunks;
  }

  /**
   * Sort chunks by various criteria
   */
  static sortChunks(
    chunks: BookChunk[],
    sortBy: 'relevance' | 'date' | 'title' | 'group' | 'similarity' = 'relevance',
    order: 'asc' | 'desc' = 'desc'
  ): BookChunk[] {
    const sortedChunks = [...chunks];

    switch (sortBy) {
      case 'relevance':
        // For relevance sorting, we assume chunks have a similarity score
        sortedChunks.sort((a, b) => {
          const aScore = (a as any).similarity || 0;
          const bScore = (b as any).similarity || 0;
          return order === 'desc' ? bScore - aScore : aScore - bScore;
        });
        break;

      case 'date':
        sortedChunks.sort((a, b) => {
          const aDate = new Date(a.createdAt).getTime();
          const bDate = new Date(b.createdAt).getTime();
          return order === 'desc' ? bDate - aDate : aDate - bDate;
        });
        break;

      case 'title':
        sortedChunks.sort((a, b) => {
          const comparison = a.title.localeCompare(b.title);
          return order === 'desc' ? -comparison : comparison;
        });
        break;

      case 'group':
        sortedChunks.sort((a, b) => {
          const comparison = a.denseVectorIndexGroup.localeCompare(b.denseVectorIndexGroup);
          return order === 'desc' ? -comparison : comparison;
        });
        break;

      case 'similarity':
        sortedChunks.sort((a, b) => {
          const aScore = (a as any).similarity || 0;
          const bScore = (b as any).similarity || 0;
          return order === 'desc' ? bScore - aScore : aScore - bScore;
        });
        break;
    }

    return sortedChunks;
  }

  /**
   * Apply group-based filtering with priority
   */
  static filterByGroupsWithPriority(
    chunks: BookChunk[],
    groups: string[],
    priorities: Record<string, number> = {}
  ): BookChunk[] {
    // Create a map of group to priority (default to 0 if not specified)
    const groupPriorityMap = new Map<string, number>();
    for (const group of groups) {
      groupPriorityMap.set(group, priorities[group] || 0);
    }

    // Filter chunks by groups and sort by priority
    const filteredChunks = chunks.filter(chunk => groupPriorityMap.has(chunk.denseVectorIndexGroup));
    
    // Sort by priority (descending), then by group name, then by index
    filteredChunks.sort((a, b) => {
      const aPriority = groupPriorityMap.get(a.denseVectorIndexGroup) || 0;
      const bPriority = groupPriorityMap.get(b.denseVectorIndexGroup) || 0;
      
      if (aPriority !== bPriority) {
        return bPriority - aPriority; // Higher priority first
      }
      
      // If same priority, sort by group name
      const groupComparison = a.denseVectorIndexGroup.localeCompare(b.denseVectorIndexGroup);
      if (groupComparison !== 0) {
        return groupComparison;
      }
      
      // If same group, sort by index
      return a.index - b.index;
    });

    return filteredChunks;
  }

  /**
   * Apply strategy-based filtering with weights
   */
  static filterByStrategiesWithWeights(
    chunks: BookChunk[],
    strategies: string[],
    weights: Record<string, number> = {}
  ): BookChunk[] {
    // Create a map of strategy to weight (default to 1.0 if not specified)
    const strategyWeightMap = new Map<string, number>();
    for (const strategy of strategies) {
      strategyWeightMap.set(strategy, weights[strategy] || 1.0);
    }

    // Filter chunks by strategies and calculate weighted scores
    const filteredChunks = chunks
      .filter(chunk => strategyWeightMap.has(chunk.strategyMetadata.chunkingStrategy))
      .map(chunk => {
        const weight = strategyWeightMap.get(chunk.strategyMetadata.chunkingStrategy) || 1.0;
        const similarity = (chunk as any).similarity || 0;
        return {
          ...chunk,
          weightedScore: similarity * weight,
        };
      });

    // Sort by weighted score (descending)
    filteredChunks.sort((a, b) => b.weightedScore - a.weightedScore);

    return filteredChunks;
  }

  /**
   * Apply provider-based filtering with preferences
   */
  static filterByProvidersWithPreferences(
    chunks: BookChunk[],
    providers: string[],
    preferences: Record<string, number> = {}
  ): BookChunk[] {
    // Create a map of provider to preference (default to 1.0 if not specified)
    const providerPreferenceMap = new Map<string, number>();
    for (const provider of providers) {
      providerPreferenceMap.set(provider, preferences[provider] || 1.0);
    }

    // Filter chunks by providers and calculate preference scores
    const filteredChunks = chunks
      .filter(chunk => providerPreferenceMap.has(chunk.strategyMetadata.embeddingProvider))
      .map(chunk => {
        const preference = providerPreferenceMap.get(chunk.strategyMetadata.embeddingProvider) || 1.0;
        const similarity = (chunk as any).similarity || 0;
        return {
          ...chunk,
          preferenceScore: similarity * preference,
        };
      });

    // Sort by preference score (descending)
    filteredChunks.sort((a, b) => b.preferenceScore - a.preferenceScore);

    return filteredChunks;
  }

  /**
   * Deduplicate chunks by content similarity
   */
  static deduplicateChunks(
    chunks: BookChunk[],
    similarityThreshold: number = 0.9
  ): BookChunk[] {
    const deduplicatedChunks: BookChunk[] = [];
    const seenContent = new Set<string>();

    for (const chunk of chunks) {
      // Create a content signature for comparison
      const contentSignature = this.createContentSignature(chunk.content);
      
      // Check if we've seen similar content
      let isDuplicate = false;
      for (const existingSignature of seenContent) {
        if (this.calculateContentSimilarity(contentSignature, existingSignature) >= similarityThreshold) {
          isDuplicate = true;
          break;
        }
      }

      if (!isDuplicate) {
        deduplicatedChunks.push(chunk);
        seenContent.add(contentSignature);
      }
    }

    return deduplicatedChunks;
  }

  /**
   * Create a content signature for similarity comparison
   */
  private static createContentSignature(content: string): string {
    // Simple content signature: first 100 chars + last 100 chars + word count
    const words = content.split(/\s+/);
    const first100 = content.substring(0, 100);
    const last100 = content.substring(content.length - 100);
    return `${first100}|${last100}|${words.length}`;
  }

  /**
   * Calculate content similarity between two signatures
   */
  private static calculateContentSimilarity(sig1: string, sig2: string): number {
    const [first1, last1, count1] = sig1.split('|');
    const [first2, last2, count2] = sig2.split('|');

    // Calculate similarity based on first and last parts
    const firstSimilarity = this.calculateStringSimilarity(first1, first2);
    const lastSimilarity = this.calculateStringSimilarity(last1, last2);
    
    // Calculate count similarity
    const countNum1 = parseInt(count1) || 0;
    const countNum2 = parseInt(count2) || 0;
    const maxCount = Math.max(countNum1, countNum2);
    const countSimilarity = maxCount > 0 ? 1 - Math.abs(countNum1 - countNum2) / maxCount : 1;

    // Weighted average
    return (firstSimilarity * 0.4 + lastSimilarity * 0.4 + countSimilarity * 0.2);
  }

  /**
   * Calculate string similarity using simple character overlap
   */
  private static calculateStringSimilarity(str1: string, str2: string): number {
    if (str1 === str2) return 1.0;
    if (str1.length === 0 || str2.length === 0) return 0.0;

    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private static levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) {
      matrix[0][i] = i;
    }

    for (let j = 0; j <= str2.length; j++) {
      matrix[j][0] = j;
    }

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // deletion
          matrix[j - 1][i] + 1, // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Apply advanced filtering with multiple criteria
   */
  static applyAdvancedFiltering(
    chunks: BookChunk[],
    filter: ChunkSearchFilter,
    options?: {
      groupPriorities?: Record<string, number>;
      strategyWeights?: Record<string, number>;
      providerPreferences?: Record<string, number>;
      deduplicate?: boolean;
      deduplicationThreshold?: number;
      sortBy?: 'relevance' | 'date' | 'title' | 'group' | 'similarity';
      sortOrder?: 'asc' | 'desc';
    }
  ): BookChunk[] {
    let filteredChunks = this.filterChunks(chunks, filter);

    // Apply group priorities
    if (options?.groupPriorities && filter.groups) {
      filteredChunks = this.filterByGroupsWithPriority(
        filteredChunks,
        filter.groups,
        options.groupPriorities
      );
    }

    // Apply strategy weights
    if (options?.strategyWeights && filter.chunkingStrategies) {
      filteredChunks = this.filterByStrategiesWithWeights(
        filteredChunks,
        filter.chunkingStrategies,
        options.strategyWeights
      );
    }

    // Apply provider preferences
    if (options?.providerPreferences && filter.embeddingProviders) {
      filteredChunks = this.filterByProvidersWithPreferences(
        filteredChunks,
        filter.embeddingProviders,
        options.providerPreferences
      );
    }

    // Deduplicate if requested
    if (options?.deduplicate) {
      filteredChunks = this.deduplicateChunks(
        filteredChunks,
        options.deduplicationThreshold || 0.9
      );
    }

    // Apply final sorting
    if (options?.sortBy) {
      filteredChunks = this.sortChunks(
        filteredChunks,
        options.sortBy,
        options.sortOrder || 'desc'
      );
    }

    // Apply limit
    if (filter.limit && filteredChunks.length > filter.limit) {
      filteredChunks = filteredChunks.slice(0, filter.limit);
    }

    return filteredChunks;
  }
}