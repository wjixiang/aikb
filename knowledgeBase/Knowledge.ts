import Entity from './Entity';
import { KnowledgeData, KnowledgeDataWithId } from './knowledge.type';
import { AbstractKnowledgeStorage } from './storage/abstract-storage';
import createLoggerWithPrefix from './lib/logger';

// interface KnowledgeTree {
//     id: string;
//     scope: string;
//     content: string;
//     child: KnowledgeTree[];
// }

export default class Knowledge {
  private logger = createLoggerWithPrefix('Knowledge');

  constructor(
    private id: string,
    private scope: string,
    private content: string,
    private child: Knowledge[],
    private knowledgeStorage?: AbstractKnowledgeStorage,
  ) {}

  get_id() {
    return this.id;
  }

  /**
   * Render Knowledge instance into markdown string
   */
  render_to_markdown_string(level: number = 1): string {
    let markdownContent = '';

    // Add the current knowledge content with appropriate heading level
    if (this.scope) {
      markdownContent += `${'#'.repeat(level)} ${this.scope}\n\n`;
    }

    if (this.content) {
      markdownContent += `${this.content}\n\n`;
    }

    // Recursively render children with increased level
    for (const child of this.child) {
      markdownContent += child.render_to_markdown_string(level + 1);
    }

    return markdownContent;
  }

  /**
   * Subdivide current knowledge node
   * @param new_knowledge
   */
  async subdivide(new_knowledge: KnowledgeData): Promise<Knowledge> {
    if (!this.knowledgeStorage) {
      throw new Error('Knowledge storage not initialized');
    }

    // Create new knowledge as child of current knowledge
    const childKnowledgeData = await this.knowledgeStorage.create_new_knowledge(
      new_knowledge,
      this.id,
    );

    // Create knowledge instance
    const childKnowledge =
      await this.knowledgeStorage.create_knowledge_instance(childKnowledgeData);

    // Add to children
    this.child.push(childKnowledge);

    // Update current knowledge to include new child
    await this.update({
      scope: this.scope,
      content: this.content,
      childKnowledgeId: this.child.map((child) => child.get_id()),
    });

    return childKnowledge;
  }

  /**
   * Update knowledge content
   * @param data Updated knowledge data
   */
  async update(data: Partial<KnowledgeData>): Promise<void> {
    if (!this.knowledgeStorage) {
      throw new Error('Knowledge storage not initialized');
    }

    // Update local properties
    if (data.scope !== undefined) {
      this.scope = data.scope;
    }
    if (data.content !== undefined) {
      this.content = data.content;
    }

    // Update in storage
    await this.knowledgeStorage.knowledgeContentStorage.update_knowledge_content(
      this.id,
      data,
    );
  }

  /**
   * Delete knowledge and all its children
   */
  async delete(): Promise<void> {
    if (!this.knowledgeStorage) {
      throw new Error('Knowledge storage not initialized');
    }

    // Delete all children recursively
    for (const child of this.child) {
      await child.delete();
    }

    // Delete vector storage
    await this.knowledgeStorage.knowledgeVectorStorage.delete_knowledge_vector(
      this.id,
    );

    // Delete content storage
    await this.knowledgeStorage.knowledgeContentStorage.delete_knowledge_content_by_id(
      this.id,
    );

    this.logger.info(`Deleted knowledge with ID: ${this.id}`);
  }

  /**
   * Add a child knowledge
   * @param childKnowledge The child knowledge to add
   */
  async addChild(childKnowledge: Knowledge): Promise<void> {
    if (!this.knowledgeStorage) {
      throw new Error('Knowledge storage not initialized');
    }

    // Check if child already exists
    if (
      this.child.some((child) => child.get_id() === childKnowledge.get_id())
    ) {
      this.logger.warn(
        `Child knowledge ${childKnowledge.get_id()} already exists`,
      );
      return;
    }

    // Add to children
    this.child.push(childKnowledge);

    // Update current knowledge to include new child
    await this.update({
      scope: this.scope,
      content: this.content,
      childKnowledgeId: this.child.map((child) => child.get_id()),
    });

    // Create link in graph storage
    await this.knowledgeStorage.knowledgeGraphStorage.create_new_link(
      this.id,
      childKnowledge.get_id(),
    );
  }

  /**
   * Remove a child knowledge
   * @param childKnowledgeId The ID of the child knowledge to remove
   */
  async removeChild(childKnowledgeId: string): Promise<void> {
    if (!this.knowledgeStorage) {
      throw new Error('Knowledge storage not initialized');
    }

    // Find and remove child
    const childIndex = this.child.findIndex(
      (child) => child.get_id() === childKnowledgeId,
    );
    if (childIndex === -1) {
      this.logger.warn(`Child knowledge ${childKnowledgeId} not found`);
      return;
    }

    // Remove from children array
    this.child.splice(childIndex, 1);

    // Update current knowledge to reflect removed child
    await this.update({
      scope: this.scope,
      content: this.content,
      childKnowledgeId: this.child.map((child) => child.get_id()),
    });
  }

  /**
   * Get all children knowledge
   * @returns Array of child knowledge instances
   */
  getChildren(): Knowledge[] {
    return [...this.child];
  }

  /**
   * Get knowledge data
   * @returns Knowledge data object
   */
  getData(): KnowledgeDataWithId {
    return {
      id: this.id,
      scope: this.scope,
      content: this.content,
      childKnowledgeId: this.child.map((child) => child.get_id()),
    };
  }
}

/**
 * Temporary in-memory knowledge.
 *
 */
export class TKnowledge {
  constructor(
    private data: KnowledgeData,
    private source: Entity | Knowledge,
  ) {}

  async save(storage: AbstractKnowledgeStorage): Promise<Knowledge> {
    const save_res = await storage.create_new_knowledge(
      this.data,
      this.source.get_id(),
    );

    // Create knowledge instance with storage reference
    const knowledge = await storage.create_knowledge_instance(save_res);

    // Set storage reference for future operations
    (knowledge as any).knowledgeStorage = storage;

    return knowledge;
  }
}
