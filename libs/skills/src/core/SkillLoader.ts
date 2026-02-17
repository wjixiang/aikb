import * as fs from 'fs/promises';
import * as path from 'path';
import { SkillParser } from '../parser/SkillParser';
import { SkillRegistry } from './SkillRegistry';

/**
 * Skill Loader - loads skills from markdown files
 */
export class SkillLoader {
  private parser: SkillParser;

  constructor(private registry: SkillRegistry) {
    this.parser = new SkillParser();
  }

  /**
   * Load all skill markdown files from a directory
   */
  async loadFromDirectory(dirPath: string): Promise<void> {
    try {
      const files = await fs.readdir(dirPath);

      for (const file of files) {
        if (file.endsWith('.skill.md')) {
          const filePath = path.join(dirPath, file);
          await this.loadFile(filePath);
        }
      }
    } catch (error) {
      console.error(`Failed to load skills from directory ${dirPath}:`, error);
      throw error;
    }
  }

  /**
   * Load a single skill file
   */
  async loadFile(filePath: string): Promise<void> {
    try {
      const skill = await this.parser.parseFile(filePath);
      this.registry.register(skill);
      console.log(`✓ Loaded skill: ${skill.name} v${skill.version}`);
    } catch (error) {
      console.error(`✗ Failed to load skill from ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Load skill from markdown string
   */
  loadFromString(markdown: string): void {
    try {
      const skill = this.parser.parse(markdown);
      this.registry.register(skill);
      console.log(`✓ Loaded skill: ${skill.name} v${skill.version}`);
    } catch (error) {
      console.error('✗ Failed to load skill from string:', error);
      throw error;
    }
  }

  /**
   * Load multiple skills from an array of markdown strings
   */
  loadFromStrings(markdowns: string[]): void {
    for (const markdown of markdowns) {
      this.loadFromString(markdown);
    }
  }

  /**
   * Reload all skills from a directory
   */
  async reloadFromDirectory(dirPath: string): Promise<void> {
    // Clear existing skills from this directory
    // (In a full implementation, we'd track which skills came from which directory)
    await this.loadFromDirectory(dirPath);
  }
}
