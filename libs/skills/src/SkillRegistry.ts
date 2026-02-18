import { SkillLoader, type ParsedSkill } from './SkillLoader.js';
import type { Skill } from './types.js';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

/**
 * Skill source information
 */
export interface SkillSource {
    /** Parsed skill data */
    parsed: ParsedSkill;
    /** Runtime skill object */
    runtime: Skill;
    /** Load timestamp */
    loadedAt: Date;
}

/**
 * SkillRegistry - Manages loading and registration of markdown-based skills
 */
export class SkillRegistry {
    private loader: SkillLoader;
    private skills: Map<string, SkillSource> = new Map();
    private repositoryPath: string;

    constructor(repositoryPath?: string) {
        this.loader = new SkillLoader();
        // Default repository path relative to this file
        this.repositoryPath = repositoryPath || join(__dirname, '../../repository');

        // Auto-load skills if repository path is provided
        if (repositoryPath) {
            this.loadFromDirectory(repositoryPath);
        }
    }

    /**
     * Load a skill from markdown content
     */
    loadFromContent(content: string, sourcePath?: string): Skill {
        const parsed = this.loader.parse(content, sourcePath);
        const runtime = this.loader.toRuntimeSkill(parsed);

        this.skills.set(parsed.frontmatter.name, {
            parsed,
            runtime,
            loadedAt: new Date()
        });

        return runtime;
    }

    /**
     * Load multiple skills from markdown contents
     */
    loadAll(contents: Array<{ content: string; sourcePath?: string }>): Skill[] {
        return contents.map(({ content, sourcePath }) =>
            this.loadFromContent(content, sourcePath)
        );
    }

    /**
     * Load all skills from a directory recursively
     * @param directoryPath - Path to the directory containing skill files
     * @returns Array of loaded skills
     */
    loadFromDirectory(directoryPath: string): Skill[] {
        const loadedSkills: Skill[] = [];

        try {
            const entries = readdirSync(directoryPath, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = join(directoryPath, entry.name);

                if (entry.isDirectory()) {
                    // Recursively load from subdirectories
                    const subSkills = this.loadFromDirectory(fullPath);
                    loadedSkills.push(...subSkills);
                } else if (entry.isFile() && extname(entry.name) === '.md') {
                    // Load skill from markdown file
                    try {
                        const content = readFileSync(fullPath, 'utf-8');
                        const skill = this.loadFromContent(content, fullPath);
                        loadedSkills.push(skill);
                        console.log(`[SkillRegistry] Loaded skill: ${skill.name} from ${fullPath}`);
                    } catch (error) {
                        console.error(`[SkillRegistry] Failed to load skill from ${fullPath}:`, error);
                    }
                }
            }
        } catch (error) {
            console.error(`[SkillRegistry] Failed to read directory ${directoryPath}:`, error);
        }

        return loadedSkills;
    }

    /**
     * Get a loaded skill by name
     */
    get(name: string): Skill | undefined {
        return this.skills.get(name)?.runtime;
    }

    /**
     * Get parsed skill data by name
     */
    getParsed(name: string): ParsedSkill | undefined {
        return this.skills.get(name)?.parsed;
    }

    /**
     * Get all loaded skills
     */
    getAll(): Skill[] {
        return Array.from(this.skills.values()).map(s => s.runtime);
    }

    /**
     * Get all skill names
     */
    getNames(): string[] {
        return Array.from(this.skills.keys());
    }

    /**
     * Check if a skill is loaded
     */
    has(name: string): boolean {
        return this.skills.has(name);
    }

    /**
     * Unload a skill
     */
    unload(name: string): boolean {
        return this.skills.delete(name);
    }

    /**
     * Clear all loaded skills
     */
    clear(): void {
        this.skills.clear();
    }

    /**
     * Get skills by category
     */
    getByCategory(category: string): Skill[] {
        return Array.from(this.skills.values())
            .filter(s => s.parsed.frontmatter.category === category)
            .map(s => s.runtime);
    }

    /**
     * Get skills by tag
     */
    getByTag(tag: string): Skill[] {
        return Array.from(this.skills.values())
            .filter(s => s.parsed.frontmatter.tags?.includes(tag))
            .map(s => s.runtime);
    }

    /**
     * Search skills by query
     */
    search(query: string): Skill[] {
        const lowerQuery = query.toLowerCase();

        return Array.from(this.skills.values())
            .filter(s => {
                const { frontmatter } = s.parsed;
                return (
                    frontmatter.name.toLowerCase().includes(lowerQuery) ||
                    frontmatter.description.toLowerCase().includes(lowerQuery) ||
                    frontmatter.tags?.some(t => t.toLowerCase().includes(lowerQuery)) ||
                    s.parsed.title.toLowerCase().includes(lowerQuery)
                );
            })
            .map(s => s.runtime);
    }

    /**
     * Get the number of loaded skills
     */
    get size(): number {
        return this.skills.size;
    }

    /**
     * Get skill statistics
     */
    getStats(): {
        totalSkills: number;
        categories: Record<string, number>;
        tags: Record<string, number>;
    } {
        const categories: Record<string, number> = {};
        const tags: Record<string, number> = {};

        for (const source of this.skills.values()) {
            const { frontmatter } = source.parsed;

            // Count categories
            if (frontmatter.category) {
                categories[frontmatter.category] = (categories[frontmatter.category] || 0) + 1;
            }

            // Count tags
            for (const tag of frontmatter.tags || []) {
                tags[tag] = (tags[tag] || 0) + 1;
            }
        }

        return {
            totalSkills: this.skills.size,
            categories,
            tags
        };
    }

    /**
     * Validate a skill markdown content without loading
     */
    validate(content: string): { valid: boolean; errors: string[] } {
        const errors: string[] = [];

        try {
            const parsed = this.loader.parse(content);

            // Check required fields
            if (!parsed.frontmatter.name) {
                errors.push('Missing required field: name');
            }
            if (!parsed.frontmatter.version) {
                errors.push('Missing required field: version');
            }
            if (!parsed.frontmatter.description) {
                errors.push('Missing required field: description');
            }

            // Check title
            if (!parsed.title) {
                errors.push('Missing skill title (H1 header)');
            }

            // Check capabilities
            if (parsed.capabilities.length === 0) {
                errors.push('Warning: No capabilities defined');
            }

            // Check work direction
            if (!parsed.workDirection) {
                errors.push('Warning: No work direction defined');
            }

        } catch (error) {
            errors.push(`Parse error: ${error instanceof Error ? error.message : String(error)}`);
        }

        return {
            valid: errors.filter(e => !e.startsWith('Warning')).length === 0,
            errors
        };
    }

    /**
     * Get the repository path
     */
    getRepositoryPath(): string {
        return this.repositoryPath;
    }
}
