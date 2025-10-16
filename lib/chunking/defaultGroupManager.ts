import { ChunkingEmbeddingGroup, EmbeddingConfig } from '../../knowledgeBase/knowledgeImport/library';
import { ChunkingConfig } from './chunkingStrategy';
import { embeddingService } from '../embedding/embedding';

/**
 * Default Group Manager
 * 
 * This class manages default strategy groups for chunking and embedding.
 * It provides sensible defaults and allows for configuration of default
 * groups based on different strategies and providers.
 */
export class DefaultGroupManager {
  private static instance: DefaultGroupManager;
  private defaultGroups: Map<string, ChunkingEmbeddingGroup> = new Map();
  
  private constructor() {
    this.initializeDefaultGroups();
  }
  
  /**
   * Get singleton instance
   */
  static getInstance(): DefaultGroupManager {
    if (!DefaultGroupManager.instance) {
      DefaultGroupManager.instance = new DefaultGroupManager();
    }
    return DefaultGroupManager.instance;
  }
  
  /**
   * Initialize default strategy groups
   */
  private initializeDefaultGroups(): void {
    // Get the active embedding provider
    const activeProvider = embeddingService.getProvider();
    
    // Default H1 chunking group
    const h1Group: ChunkingEmbeddingGroup = {
      id: 'default-h1',
      name: 'Default H1 Chunking',
      description: 'Default group for H1-based chunking strategy',
      chunkingStrategy: 'h1',
      chunkingConfig: {
        maxChunkSize: 1500,
        minChunkSize: 200,
        overlap: 100,
      },
      embeddingProvider: activeProvider,
      embeddingConfig: {
        model: 'default',
        batchSize: 32,
        maxRetries: 3,
        timeout: 30000,
      },
      version: '1.0.0',
      isDefault: true,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      tags: ['default', 'h1'],
    };
    
    // Default paragraph chunking group
    const paragraphGroup: ChunkingEmbeddingGroup = {
      id: 'default-paragraph',
      name: 'Default Paragraph Chunking',
      description: 'Default group for paragraph-based chunking strategy',
      chunkingStrategy: 'paragraph',
      chunkingConfig: {
        maxChunkSize: 1000,
        minChunkSize: 100,
        overlap: 50,
      },
      embeddingProvider: activeProvider,
      embeddingConfig: {
        model: 'default',
        batchSize: 32,
        maxRetries: 3,
        timeout: 30000,
      },
      version: '1.0.0',
      isDefault: false,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      tags: ['default', 'paragraph'],
    };
    
    this.defaultGroups.set('h1', h1Group);
    this.defaultGroups.set('paragraph', paragraphGroup);
  }
  
  /**
   * Get default group for a specific strategy
   * @param strategy The chunking strategy
   * @returns The default group for the strategy
   */
  getDefaultGroup(strategy: string): ChunkingEmbeddingGroup | null {
    // First try to get the exact strategy match
    const exactMatch = this.defaultGroups.get(strategy);
    if (exactMatch) {
      return exactMatch;
    }

    // If no exact match, try to find a compatible strategy
    const fallbackStrategy = this.findFallbackStrategy(strategy);
    if (fallbackStrategy) {
      return this.defaultGroups.get(fallbackStrategy) || null;
    }

    // As a last resort, return the primary default group
    return this.getPrimaryDefaultGroup();
  }

  /**
   * Find a fallback strategy for the given strategy
   */
  private findFallbackStrategy(strategy: string): string | null {
    // Define fallback hierarchy
    const fallbackHierarchy: Record<string, string[]> = {
      'semantic': ['h1', 'paragraph'],
      'h1': ['paragraph'],
      'paragraph': ['h1'],
      'mixed': ['h1', 'paragraph'],
      'custom': ['h1', 'paragraph'],
    };

    // Check if we have a fallback for this strategy
    const fallbacks = fallbackHierarchy[strategy];
    if (fallbacks) {
      for (const fallback of fallbacks) {
        if (this.defaultGroups.has(fallback)) {
          return fallback;
        }
      }
    }

    // If no specific fallback, try to find any available strategy
    for (const [availableStrategy] of this.defaultGroups.entries()) {
      return availableStrategy;
    }

    return null;
  }
  
  /**
   * Get default group ID for a specific strategy
   * @param strategy The chunking strategy
   * @returns The default group ID for the strategy
   */
  getDefaultGroupId(strategy: string): string | null {
    const group = this.getDefaultGroup(strategy);
    return group ? group.id : null;
  }
  
  /**
   * Get all default groups
   * @returns Array of all default groups
   */
  getAllDefaultGroups(): ChunkingEmbeddingGroup[] {
    return Array.from(this.defaultGroups.values());
  }
  
  /**
   * Get the primary default group (the one marked as isDefault)
   * @returns The primary default group
   */
  getPrimaryDefaultGroup(): ChunkingEmbeddingGroup | null {
    for (const group of this.defaultGroups.values()) {
      if (group.isDefault) {
        return group;
      }
    }
    // Fallback to first group if none is marked as default
    return this.defaultGroups.size > 0 ? this.defaultGroups.values().next().value : null;
  }
  
  /**
   * Update or add a default group
   * @param strategy The strategy key
   * @param group The group configuration
   */
  setDefaultGroup(strategy: string, group: ChunkingEmbeddingGroup): void {
    const updatedGroup = {
      ...group,
      updatedAt: new Date(),
    };
    this.defaultGroups.set(strategy, updatedGroup);
  }
  
  /**
   * Create a custom group based on a strategy with custom configurations
   * @param strategy The base strategy
   * @param customConfig Custom configuration overrides
   * @returns A new group with custom configurations
   */
  createCustomGroup(
    strategy: string,
    customConfig: {
      name?: string;
      description?: string;
      chunkingConfig?: Partial<ChunkingConfig>;
      embeddingProvider?: string;
      embeddingConfig?: Partial<EmbeddingConfig>;
      version?: string;
      tags?: string[];
    }
  ): ChunkingEmbeddingGroup {
    const baseGroup = this.getDefaultGroup(strategy);
    if (!baseGroup) {
      throw new Error(`No default group found for strategy: ${strategy}`);
    }
    
    const customGroup: ChunkingEmbeddingGroup = {
      ...baseGroup,
      id: `custom-${strategy}-${Date.now()}`,
      name: customConfig.name || `Custom ${strategy} Chunking`,
      description: customConfig.description || `Custom group for ${strategy} strategy`,
      chunkingConfig: {
        ...baseGroup.chunkingConfig,
        ...customConfig.chunkingConfig,
      },
      embeddingProvider: customConfig.embeddingProvider || baseGroup.embeddingProvider,
      embeddingConfig: {
        ...baseGroup.embeddingConfig,
        ...customConfig.embeddingConfig,
      },
      version: customConfig.version || '1.0.0',
      isDefault: false,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      tags: customConfig.tags || ['custom', strategy],
    };
    
    return customGroup;
  }
  
  /**
   * Validate group configuration
   * @param group The group to validate
   * @returns Validation result
   */
  validateGroup(group: Partial<ChunkingEmbeddingGroup>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!group.name || group.name.trim() === '') {
      errors.push('Group name is required');
    }
    
    if (!group.chunkingStrategy || group.chunkingStrategy.trim() === '') {
      errors.push('Chunking strategy is required');
    }
    
    if (!group.embeddingProvider || group.embeddingProvider.trim() === '') {
      errors.push('Embedding provider is required');
    }
    
    if (!group.version || group.version.trim() === '') {
      errors.push('Version is required');
    }
    
    if (group.chunkingConfig) {
      if (typeof group.chunkingConfig.maxChunkSize === 'number' && group.chunkingConfig.maxChunkSize <= 0) {
        errors.push('maxChunkSize must be positive');
      }
      if (typeof group.chunkingConfig.minChunkSize === 'number' && group.chunkingConfig.minChunkSize <= 0) {
        errors.push('minChunkSize must be positive');
      }
      if (typeof group.chunkingConfig.overlap === 'number' && group.chunkingConfig.overlap < 0) {
        errors.push('overlap must be non-negative');
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
    };
  }
  
  /**
   * Get recommended group for a specific use case
   * @param useCase The use case (e.g., 'research', 'qa', 'summary')
   * @param strategy Optional strategy preference
   * @returns Recommended group configuration
   */
  getRecommendedGroup(useCase: string, strategy?: string): ChunkingEmbeddingGroup | null {
    // For now, return the default group for the strategy
    // In a full implementation, this would have more sophisticated logic
    const selectedStrategy = strategy || 'h1';
    return this.getDefaultGroup(selectedStrategy);
  }

  /**
   * Get the best available group for search with fallback logic
   * @param preferredGroups Array of preferred group IDs in order of preference
   * @returns The best available group or null
   */
  getBestAvailableGroup(preferredGroups?: string[]): ChunkingEmbeddingGroup | null {
    // If no preferred groups specified, return the primary default group
    if (!preferredGroups || preferredGroups.length === 0) {
      return this.getPrimaryDefaultGroup();
    }

    // Try each preferred group in order
    for (const groupId of preferredGroups) {
      // Check if it's a strategy name
      const group = this.getDefaultGroup(groupId);
      if (group) {
        return group;
      }
    }

    // If none of the preferred groups are available, return the primary default group
    return this.getPrimaryDefaultGroup();
  }

  /**
   * Get fallback group ID for search when specific group is not available
   * @param requestedGroupId The requested group ID
   * @returns A fallback group ID or null
   */
  getFallbackGroupId(requestedGroupId: string): string | null {
    // Check if the requested group exists
    if (this.defaultGroups.has(requestedGroupId)) {
      return requestedGroupId;
    }

    // Try to find a compatible strategy
    const fallbackStrategy = this.findFallbackStrategy(requestedGroupId);
    if (fallbackStrategy) {
      const group = this.defaultGroups.get(fallbackStrategy);
      if (group) {
        return group.id;
      }
    }

    // Return the primary default group ID
    const primaryGroup = this.getPrimaryDefaultGroup();
    return primaryGroup ? primaryGroup.id : null;
  }

  /**
   * Get group configuration for search with fallback
   * @param searchOptions The search options
   * @returns Resolved group configuration
   */
  getGroupConfigForSearch(searchOptions: {
    denseVectorIndexGroup?: string;
    chunkingStrategy?: string;
    embeddingProvider?: string;
    fallbackToDefault?: boolean;
  }): {
    groupId: string;
    group: ChunkingEmbeddingGroup;
    usedFallback: boolean;
  } | null {
    const { denseVectorIndexGroup, chunkingStrategy, embeddingProvider, fallbackToDefault = true } = searchOptions;

    let group: ChunkingEmbeddingGroup | null = null;
    let usedFallback = false;

    // Try to get group by ID first
    if (denseVectorIndexGroup) {
      group = this.defaultGroups.get(denseVectorIndexGroup) || null;
      if (!group && fallbackToDefault) {
        const fallbackGroupId = this.getFallbackGroupId(denseVectorIndexGroup);
        if (fallbackGroupId) {
          group = this.defaultGroups.get(fallbackGroupId) || null;
          usedFallback = true;
        }
      }
    }

    // If no group found, try by strategy
    if (!group && chunkingStrategy) {
      group = this.getDefaultGroup(chunkingStrategy);
      if (group) {
        usedFallback = !denseVectorIndexGroup;
      }
    }

    // If still no group, try by embedding provider
    if (!group && embeddingProvider) {
      for (const [strategy, strategyGroup] of this.defaultGroups.entries()) {
        if (strategyGroup.embeddingProvider === embeddingProvider) {
          group = strategyGroup;
          usedFallback = true;
          break;
        }
      }
    }

    // If still no group, use primary default
    if (!group && fallbackToDefault) {
      group = this.getPrimaryDefaultGroup();
      usedFallback = true;
    }

    if (!group) {
      return null;
    }

    return {
      groupId: group.id,
      group,
      usedFallback,
    };
  }
}