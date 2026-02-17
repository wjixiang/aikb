import { Skill } from '../core/Skill.interface';

/**
 * Skill Serializer - converts Skill objects to markdown format
 */
export class SkillSerializer {
  /**
   * Serialize Skill object to markdown
   */
  serialize(skill: Skill): string {
    const sections: string[] = [];

    // 1. Frontmatter
    sections.push(this.serializeFrontmatter(skill));

    // 2. Title and Description
    sections.push(`# ${this.toTitleCase(skill.name)}\n`);
    sections.push(`${skill.description}\n`);

    // 3. Capabilities
    if (skill.promptFragments?.capability) {
      sections.push('## Capabilities\n');
      sections.push(`${skill.promptFragments.capability}\n`);
    }

    // 4. Work Direction
    if (skill.promptFragments?.direction) {
      sections.push('## Work Direction\n');
      sections.push(`${skill.promptFragments.direction}\n`);
    }

    // 5. Required Tools
    if (skill.requiredTools && skill.requiredTools.length > 0) {
      sections.push('## Required Tools\n');
      skill.requiredTools.forEach(tool => {
        sections.push(`- \`${tool}\`\n`);
      });
      sections.push('');
    }

    // 6. Provided Tools
    if (skill.tools && Object.keys(skill.tools).length > 0) {
      sections.push('## Provided Tools\n');
      for (const [name, toolFunc] of Object.entries(skill.tools)) {
        sections.push(`### ${name}\n`);
        sections.push(`${toolFunc.description}\n`);
        sections.push('**Implementation:**\n');
        sections.push('```typescript');
        sections.push(toolFunc.handler.toString());
        sections.push('```\n');
      }
    }

    // 7. Orchestration
    if (skill.orchestrate) {
      sections.push('## Orchestration\n');
      sections.push('```typescript');
      sections.push(skill.orchestrate.toString());
      sections.push('```\n');
    }

    // 8. Helper Functions
    if (skill.helpers && Object.keys(skill.helpers).length > 0) {
      sections.push('## Helper Functions\n');
      sections.push('```typescript');
      for (const [name, func] of Object.entries(skill.helpers)) {
        sections.push(`// ${name}`);
        sections.push(func.toString());
        sections.push('');
      }
      sections.push('```\n');
    }

    // 9. Metadata
    if (skill.metadata) {
      sections.push('## Metadata\n');
      if (skill.metadata.author) {
        sections.push(`- **Author**: ${skill.metadata.author}`);
      }
      if (skill.metadata.created) {
        sections.push(`- **Created**: ${skill.metadata.created}`);
      }
      if (skill.metadata.lastUpdated) {
        sections.push(`- **Last Updated**: ${skill.metadata.lastUpdated}`);
      }
      if (skill.metadata.complexity) {
        sections.push(`- **Complexity**: ${skill.metadata.complexity}`);
      }
      sections.push('');
    }

    return sections.join('\n');
  }

  private serializeFrontmatter(skill: Skill): string {
    const lines: string[] = ['---'];

    lines.push(`name: ${skill.name}`);
    lines.push(`version: ${skill.version}`);
    lines.push(`description: ${skill.description}`);

    if (skill.metadata?.category) {
      lines.push(`category: ${skill.metadata.category}`);
    }

    if (skill.metadata?.tags && skill.metadata.tags.length > 0) {
      lines.push(`tags: [${skill.metadata.tags.join(', ')}]`);
    }

    lines.push('---\n');

    return lines.join('\n');
  }

  private toTitleCase(str: string): string {
    return str
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}
