import type { Skill } from '../core/Skill.interface.js';
import * as fs from 'fs/promises';

/**
 * Skill Parser - parses markdown files into Skill objects
 * This is a simplified implementation. Full implementation would use marked/remark
 */
export class SkillParser {
  /**
   * Parse markdown file to Skill object
   */
  async parseFile(filePath: string): Promise<Skill> {
    const content = await fs.readFile(filePath, 'utf-8');
    return this.parse(content);
  }

  /**
   * Parse markdown string to Skill object
   */
  parse(markdown: string): Skill {
    // Extract frontmatter
    const { frontmatter, body } = this.extractFrontmatter(markdown);

    // Parse sections
    const sections = this.parseSections(body);

    // Build skill object
    const skill: Skill = {
      name: frontmatter.name || 'unnamed-skill',
      version: frontmatter.version || '1.0.0',
      description: frontmatter.description || this.extractDescription(sections),

      promptFragments: {
        capability: sections['Capabilities'] || '',
        direction: sections['Work Direction'] || '',
        systemPrompt: sections['System Prompt'] || ''
      },

      requiredTools: this.parseRequiredTools(sections['Required Tools'] || ''),

      // Note: Full implementation would parse and compile tool functions
      // For now, returning empty objects
      tools: {},
      helpers: {},

      metadata: (() => {
        const metadata: {
          category?: string;
          tags?: string[];
          author?: string;
          created?: string;
          lastUpdated?: string;
          complexity?: 'low' | 'medium' | 'high';
        } = {};

        if (frontmatter.category) {
          metadata.category = frontmatter.category;
        }
        if (frontmatter.tags) {
          metadata.tags = frontmatter.tags;
        }

        const author = this.extractMetadataField(
          sections['Metadata'] || '',
          'Author'
        );
        if (author !== undefined) {
          metadata.author = author;
        }

        const created = this.extractMetadataField(
          sections['Metadata'] || '',
          'Created'
        );
        if (created !== undefined) {
          metadata.created = created;
        }

        const lastUpdated = this.extractMetadataField(
          sections['Metadata'] || '',
          'Last Updated'
        );
        if (lastUpdated !== undefined) {
          metadata.lastUpdated = lastUpdated;
        }

        const complexity = this.extractMetadataField(
          sections['Metadata'] || '',
          'Complexity'
        ) as 'low' | 'medium' | 'high' | undefined;
        if (complexity !== undefined) {
          metadata.complexity = complexity;
        }

        return metadata;
      })()
    };

    return skill;
  }

  private extractFrontmatter(markdown: string): {
    frontmatter: any;
    body: string;
  } {
    const match = markdown.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!match) {
      return { frontmatter: {}, body: markdown };
    }

    // Simple YAML parsing (for basic key-value pairs)
    const frontmatter: any = {};
    const lines = (match[1] ?? '').split('\n');
    for (const line of lines) {
      const [key, ...valueParts] = line.split(':');
      if (key && valueParts.length > 0) {
        const value = valueParts.join(':').trim();
        // Handle arrays
        if (value.startsWith('[') && value.endsWith(']')) {
          frontmatter[key.trim()] = value
            .slice(1, -1)
            .split(',')
            .map(v => v.trim());
        } else {
          frontmatter[key.trim()] = value;
        }
      }
    }

    return {
      frontmatter,
      body: match[2] ?? markdown
    };
  }

  private parseSections(body: string): Record<string, string> {
    const sections: Record<string, string> = {};
    const lines = body.split('\n');

    let currentSection = '';
    let currentContent: string[] = [];

    for (const line of lines) {
      // Check for section header (## Section Name)
      if (line.match(/^##\s+(.+)$/)) {
        // Save previous section
        if (currentSection) {
          sections[currentSection] = currentContent.join('\n').trim();
        }

        // Start new section
        currentSection = line.replace(/^##\s+/, '');
        currentContent = [];
      } else {
        currentContent.push(line);
      }
    }

    // Save last section
    if (currentSection) {
      sections[currentSection] = currentContent.join('\n').trim();
    }

    return sections;
  }

  private extractDescription(sections: Record<string, string>): string {
    // Description is usually the first paragraph after the title
    for (const content of Object.values(sections)) {
      const lines = content.split('\n').filter(l => l.trim());
      if (lines.length > 0) {
        return lines[0] ?? '';
      }
    }
    return '';
  }

  private parseRequiredTools(content: string): string[] {
    const tools: string[] = [];
    const matches = Array.from(content.matchAll(/`([^`]+)`/g));
    for (const match of matches) {
      const tool = match[1];
      if (tool !== undefined) {
        tools.push(tool);
      }
    }
    return tools;
  }

  private extractMetadataField(content: string, field: string): string | undefined {
    const match = content.match(
      new RegExp(`\\*\\*${field}\\*\\*:\\s*(.+)`, 'i')
    );
    return match ? (match[1]?.trim() ?? undefined) : undefined;
  }
}
