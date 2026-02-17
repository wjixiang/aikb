import { Skill } from './Skill.interface';

/**
 * Skill Registry - manages skill registration and dependency resolution
 */
export class SkillRegistry {
  private skills = new Map<string, Skill>();

  /**
   * Register a skill
   */
  register(skill: Skill): void {
    if (this.skills.has(skill.name)) {
      console.warn(`Skill "${skill.name}" is already registered. Overwriting.`);
    }
    this.skills.set(skill.name, skill);
  }

  /**
   * Get a skill by name
   */
  get(name: string): Skill | undefined {
    return this.skills.get(name);
  }

  /**
   * Check if a skill exists
   */
  has(name: string): boolean {
    return this.skills.has(name);
  }

  /**
   * List all registered skills
   */
  list(): Skill[] {
    return Array.from(this.skills.values());
  }

  /**
   * List skills by category
   */
  listByCategory(category: string): Skill[] {
    return this.list().filter(s => s.metadata?.category === category);
  }

  /**
   * Search skills by tags
   */
  searchByTags(tags: string[]): Skill[] {
    return this.list().filter(skill => {
      if (!skill.metadata?.tags) return false;
      return tags.some(tag => skill.metadata!.tags!.includes(tag));
    });
  }

  /**
   * Resolve dependencies and return ordered skill list
   * Uses topological sort to handle dependencies
   */
  resolveDependencies(skillNames: string[]): Skill[] {
    const resolved: Skill[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (name: string) => {
      if (visited.has(name)) return;
      if (visiting.has(name)) {
        throw new Error(`Circular dependency detected: ${name}`);
      }

      const skill = this.get(name);
      if (!skill) {
        throw new Error(`Skill not found: ${name}`);
      }

      visiting.add(name);

      // Visit dependencies first (if any)
      if (skill.requiredTools) {
        // Note: requiredTools are tool names, not skill names
        // For skill dependencies, we'd need a separate field
        // This is a simplified implementation
      }

      visiting.delete(name);
      visited.add(name);
      resolved.push(skill);
    };

    for (const name of skillNames) {
      visit(name);
    }

    return resolved;
  }

  /**
   * Unregister a skill
   */
  unregister(name: string): boolean {
    return this.skills.delete(name);
  }

  /**
   * Clear all skills
   */
  clear(): void {
    this.skills.clear();
  }

  /**
   * Get registry statistics
   */
  getStats(): {
    total: number;
    byCategory: Record<string, number>;
    byComplexity: Record<string, number>;
  } {
    const skills = this.list();
    const byCategory: Record<string, number> = {};
    const byComplexity: Record<string, number> = {};

    for (const skill of skills) {
      const category = skill.metadata?.category || 'uncategorized';
      byCategory[category] = (byCategory[category] || 0) + 1;

      const complexity = skill.metadata?.complexity || 'unknown';
      byComplexity[complexity] = (byComplexity[complexity] || 0) + 1;
    }

    return {
      total: skills.length,
      byCategory,
      byComplexity
    };
  }
}
