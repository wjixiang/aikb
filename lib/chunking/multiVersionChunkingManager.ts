import { BookChunk, ChunkingEmbeddingGroup, EmbeddingConfig } from '../../knowledgeBase/knowledgeImport/library';
import { ChunkingConfig, ChunkingStrategyType } from './chunkingStrategy';

/**
 * Multi-Version Chunking Manager Interface
 * 
 * This interface defines the contract for managing multiple chunking and embedding
 * strategies with versioning capabilities. It allows for creating and managing
 * different combinations of chunking strategies and embedding providers,
 * enabling semantic search across different indexing approaches.
 */
export interface IMultiVersionChunkingManager {
  /**
   * Create a new chunking/embedding group
   * @param group The group configuration without system-generated fields
   * @returns The created group with generated ID and timestamps
   */
  createGroup(group: Omit<ChunkingEmbeddingGroup, 'id' | 'createdAt' | 'updatedAt'>): ChunkingEmbeddingGroup;

  /**
   * Update an existing group
   * @param groupId The ID of the group to update
   * @param updates The partial updates to apply
   * @returns The updated group
   */
  updateGroup(groupId: string, updates: Partial<ChunkingEmbeddingGroup>): ChunkingEmbeddingGroup;

  /**
   * Delete a group (soft delete by marking as inactive)
   * @param groupId The ID of the group to delete
   * @returns True if the group was successfully deleted
   */
  deleteGroup(groupId: string): boolean;

  /**
   * Set a group as default
   * @param groupId The ID of the group to set as default
   */
  setDefaultGroup(groupId: string): void;

  /**
   * Get all active groups
   * @returns Array of active groups
   */
  getActiveGroups(): ChunkingEmbeddingGroup[];

  /**
   * Get a specific group
   * @param groupId The ID of the group to retrieve
   * @returns The group if found, null otherwise
   */
  getGroup(groupId: string): ChunkingEmbeddingGroup | null;

  /**
   * Process item chunks with a specific group
   * @param itemId The ID of the item to process
   * @param groupId The ID of the group to use for processing
   * @returns Array of processed chunks
   */
  processItemWithGroup(itemId: string, groupId: string): Promise<BookChunk[]>;

  /**
   * Process item chunks with custom configuration
   * @param itemId The ID of the item to process
   * @param chunkingStrategy The chunking strategy to use
   * @param chunkingConfig The chunking configuration
   * @param embeddingProvider The embedding provider to use
   * @param embeddingConfig The embedding configuration
   * @returns Array of processed chunks
   */
  processItemWithConfig(
    itemId: string, 
    chunkingStrategy: string, 
    chunkingConfig: ChunkingConfig,
    embeddingProvider: string,
    embeddingConfig: EmbeddingConfig
  ): Promise<BookChunk[]>;

  /**
   * Get available strategies for a group
   * @param groupId The ID of the group
   * @returns Array of available strategy names
   */
  getAvailableStrategies(groupId: string): string[];

  /**
   * Get available providers for a group
   * @param groupId The ID of the group
   * @returns Array of available provider names
   */
  getAvailableProviders(groupId: string): string[];

  /**
   * Get the default group
   * @returns The default group if set, null otherwise
   */
  getDefaultGroup(): ChunkingEmbeddingGroup | null;

  /**
   * Get groups by chunking strategy
   * @param strategy The chunking strategy to filter by
   * @returns Array of groups using the specified strategy
   */
  getGroupsByStrategy(strategy: string): ChunkingEmbeddingGroup[];

  /**
   * Get groups by embedding provider
   * @param provider The embedding provider to filter by
   * @returns Array of groups using the specified provider
   */
  getGroupsByProvider(provider: string): ChunkingEmbeddingGroup[];

  /**
   * Validate group configuration
   * @param group The group configuration to validate
   * @returns Validation result with any errors
   */
  validateGroup(group: Partial<ChunkingEmbeddingGroup>): { valid: boolean; errors: string[] };

  /**
   * Clone a group with a new configuration
   * @param groupId The ID of the group to clone
   * @param updates The updates to apply to the cloned group
   * @returns The newly created group
   */
  cloneGroup(groupId: string, updates?: Partial<ChunkingEmbeddingGroup>): ChunkingEmbeddingGroup;
}

/**
 * Default implementation of MultiVersionChunkingManager
 */
export class MultiVersionChunkingManager implements IMultiVersionChunkingManager {
  private groups: Map<string, ChunkingEmbeddingGroup> = new Map();
  private activeGroups: Map<string, ChunkingEmbeddingGroup> = new Map();
  private defaultGroupId: string | null = null;

  /**
   * Create a new chunking/embedding group
   */
  createGroup(group: Omit<ChunkingEmbeddingGroup, 'id' | 'createdAt' | 'updatedAt'>): ChunkingEmbeddingGroup {
    const now = new Date();
    const newGroup: ChunkingEmbeddingGroup = {
      ...group,
      id: this.generateGroupId(),
      createdAt: now,
      updatedAt: now,
    };

    // Validate the group before creating
    const validation = this.validateGroup(newGroup);
    if (!validation.valid) {
      throw new Error(`Invalid group configuration: ${validation.errors.join(', ')}`);
    }

    this.groups.set(newGroup.id, newGroup);
    
    if (newGroup.isActive) {
      this.activeGroups.set(newGroup.id, newGroup);
    }

    if (newGroup.isDefault) {
      this.setDefaultGroup(newGroup.id);
    }

    return newGroup;
  }

  /**
   * Update an existing group
   */
  updateGroup(groupId: string, updates: Partial<ChunkingEmbeddingGroup>): ChunkingEmbeddingGroup {
    const existingGroup = this.groups.get(groupId);
    if (!existingGroup) {
      throw new Error(`Group with ID ${groupId} not found`);
    }

    const updatedGroup: ChunkingEmbeddingGroup = {
      ...existingGroup,
      ...updates,
      id: groupId, // Ensure ID doesn't change
      createdAt: existingGroup.createdAt, // Preserve creation time
      updatedAt: new Date(),
    };

    // Validate the updated group
    const validation = this.validateGroup(updatedGroup);
    if (!validation.valid) {
      throw new Error(`Invalid group configuration: ${validation.errors.join(', ')}`);
    }

    this.groups.set(groupId, updatedGroup);

    // Update active groups map if needed
    if (updatedGroup.isActive) {
      this.activeGroups.set(groupId, updatedGroup);
    } else {
      this.activeGroups.delete(groupId);
    }

    // Update default group if needed
    if (updatedGroup.isDefault) {
      this.setDefaultGroup(groupId);
    } else if (this.defaultGroupId === groupId) {
      this.defaultGroupId = null;
    }

    return updatedGroup;
  }

  /**
   * Delete a group (soft delete by marking as inactive)
   */
  deleteGroup(groupId: string): boolean {
    const group = this.groups.get(groupId);
    if (!group) {
      return false;
    }

    // Mark as inactive
    this.updateGroup(groupId, { isActive: false });
    
    // If this was the default group, clear the default
    if (this.defaultGroupId === groupId) {
      this.defaultGroupId = null;
    }

    return true;
  }

  /**
   * Set a group as default
   */
  setDefaultGroup(groupId: string): void {
    const group = this.groups.get(groupId);
    if (!group) {
      throw new Error(`Group with ID ${groupId} not found`);
    }

    // Clear existing default
    if (this.defaultGroupId) {
      const existingDefault = this.groups.get(this.defaultGroupId);
      if (existingDefault) {
        this.updateGroup(this.defaultGroupId, { isDefault: false });
      }
    }

    // Set new default
    this.updateGroup(groupId, { isDefault: true });
    this.defaultGroupId = groupId;
  }

  /**
   * Get all active groups
   */
  getActiveGroups(): ChunkingEmbeddingGroup[] {
    return Array.from(this.activeGroups.values());
  }

  /**
   * Get a specific group
   */
  getGroup(groupId: string): ChunkingEmbeddingGroup | null {
    return this.groups.get(groupId) || null;
  }

  /**
   * Process item chunks with a specific group
   */
  async processItemWithGroup(itemId: string, groupId: string): Promise<BookChunk[]> {
    const group = this.getGroup(groupId);
    if (!group) {
      throw new Error(`Group with ID ${groupId} not found`);
    }

    return this.processItemWithConfig(
      itemId,
      group.chunkingStrategy,
      group.chunkingConfig,
      group.embeddingProvider,
      group.embeddingConfig
    );
  }

  /**
   * Process item chunks with custom configuration
   */
  async processItemWithConfig(
    itemId: string, 
    chunkingStrategy: string, 
    chunkingConfig: ChunkingConfig,
    embeddingProvider: string,
    embeddingConfig: EmbeddingConfig
  ): Promise<BookChunk[]> {
    // This method would be implemented by the concrete class
    // that has access to the actual chunking and embedding services
    throw new Error('Method not implemented - use concrete implementation');
  }

  /**
   * Get available strategies for a group
   */
  getAvailableStrategies(groupId: string): string[] {
    const group = this.getGroup(groupId);
    if (!group) {
      return [];
    }
    return [group.chunkingStrategy];
  }

  /**
   * Get available providers for a group
   */
  getAvailableProviders(groupId: string): string[] {
    const group = this.getGroup(groupId);
    if (!group) {
      return [];
    }
    return [group.embeddingProvider];
  }

  /**
   * Get the default group
   */
  getDefaultGroup(): ChunkingEmbeddingGroup | null {
    if (!this.defaultGroupId) {
      return null;
    }
    return this.getGroup(this.defaultGroupId);
  }

  /**
   * Get groups by chunking strategy
   */
  getGroupsByStrategy(strategy: string): ChunkingEmbeddingGroup[] {
    return Array.from(this.groups.values()).filter(group => 
      group.chunkingStrategy === strategy && group.isActive
    );
  }

  /**
   * Get groups by embedding provider
   */
  getGroupsByProvider(provider: string): ChunkingEmbeddingGroup[] {
    return Array.from(this.groups.values()).filter(group => 
      group.embeddingProvider === provider && group.isActive
    );
  }

  /**
   * Validate group configuration
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
   * Clone a group with a new configuration
   */
  cloneGroup(groupId: string, updates?: Partial<ChunkingEmbeddingGroup>): ChunkingEmbeddingGroup {
    const originalGroup = this.getGroup(groupId);
    if (!originalGroup) {
      throw new Error(`Group with ID ${groupId} not found`);
    }

    const clonedGroupData = {
      ...originalGroup,
      ...updates,
      // Reset system fields
      id: undefined as any,
      createdAt: undefined as any,
      updatedAt: undefined as any,
      // Ensure cloned group is not default unless explicitly specified
      isDefault: updates?.isDefault || false,
    };

    return this.createGroup(clonedGroupData);
  }

  /**
   * Generate a unique group ID
   */
  private generateGroupId(): string {
    return `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}