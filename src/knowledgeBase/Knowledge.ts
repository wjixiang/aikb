import Entity from './Entity';
import { KnowledgeData } from './knowledge.type';
import { AbstractKnowledgeStorage } from './storage/abstract-storage';

// interface KnowledgeTree {
//     id: string;
//     scope: string;
//     content: string;
//     child: KnowledgeTree[];
// }

export default class Knowledge {
  constructor(
    private id: string,
    private scope: string,
    private content: string,
    private child: Knowledge[],
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
  async subdivide(new_knowledge: KnowledgeData) {
    
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
    return storage.create_knowledge_instance(save_res);
  }
}
