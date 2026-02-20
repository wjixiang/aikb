import { SkillLoader, type ParsedSkill } from './SkillLoader.js';
import type { Skill } from './types.js';
import type { SkillDefinition } from './SkillDefinition.js';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';
import { pathToFileURL } from 'url';

/**
 * Skill source type
 */
export type SkillSourceType = 'markdown' | 'typescript';

/**
 * Skill source information
 */
export interface SkillSource {
    /** Source type */
    type: SkillSourceType;
    /** Parsed skill data (for markdown) */
    parsed?: ParsedSkill;
    /** Skill definition (for TypeScript) */
    definition?: SkillDefinition;
    /** Runtime skill object */
    runtime: Skill;
    /** Load timestamp */
    loadedAt: Date;
    /** Source file path */
    sourcePath?: string;
}

/**
 * SkillRegistry - Manages loading and registration of both markdown and TypeScript-based skills
 */
export class SkillRegistry {
    private loader: SkillLoader;
    private skills: Map<string, SkillSource> = new Map();
    private repositoryPath: string;

    constructor(repositoryPath?: string, autoLoad: boolean = false) {
        this.loader = new SkillLoader();
        // Default repository path relative to this file
        this.repositoryPath = repositoryPath || join(__dirname, '../../repository');

        // Auto-load skills if autoLoad is true
        if (autoLoad) {
            this.loadFromDirectory(this.repositoryPath);
        }
    }

    /**
     * Register skills directly (recommended for built-in skills)
     */
    registerSkills(skills: Skill[]): void {
        for (const skill of skills) {
            this.skills.set(skill.name, {
                type: 'typescript',
                runtime: skill,
                loadedAt: new Date()
            });
        }
    }

    /**
     * Register a single skill directly
     */
    registerSkill(skill: Skill): void {
        this.skills.set(skill.name, {
            type: 'typescript',
            runtime: skill,
            loadedAt: new Date()
        });
    }

    /**
     * Load a skill from markdown content
     */
    loadFromContent(content: string, sourcePath?: string): Skill {
        const parsed = this.loader.parse(content, sourcePath);
        const runtime = this.loader.toRuntimeSkill(parsed);

        this.skills.set(parsed.frontmatter.name, {
            type: 'markdown',
            parsed,
            runtime,
            loadedAt: new Date(),
            sourcePath
        });

        return runtime;
    }

    /**
     * Load a skill from TypeScript definition
     */
    loadFromDefinition(definition: SkillDefinition, sourcePath?: string): Skill {
        const runtime = definition.build();

        this.skills.set(runtime.name, {
            type: 'typescript',
            definition,
            runtime,
            loadedAt: new Date(),
            sourcePath
        });

        return runtime;
    }

    /**
     * Load a skill from TypeScript module file
     */
    async loadFromTypeScriptFile(filePath: string): Promise<Skill> {
        try {
            // Convert file path to file URL for dynamic import
            const fileUrl = pathToFileURL(filePath).href;
            const module = await import(fileUrl);

            // Look for default export or named 'skill' export
            const skillDefinition = module.default || module.skill;

            if (!skillDefinition) {
                throw new Error(`No skill definition found in ${filePath}. Expected default export or named 'skill' export.`);
            }

            // If it's already a Skill object, register it directly
            if (this.isSkillObject(skillDefinition)) {
                this.skills.set(skillDefinition.name, {
                    type: 'typescript',
                    runtime: skillDefinition,
                    loadedAt: new Date(),
                    sourcePath: filePath
                });
                return skillDefinition;
            }

            // If it's a SkillDefinition, build and register it
            if (this.isSkillDefinition(skillDefinition)) {
                return this.loadFromDefinition(skillDefinition, filePath);
            }

            throw new Error(`Invalid skill export in ${filePath}. Expected Skill or SkillDefinition.`);
        } catch (error) {
            console.error(`[SkillRegistry] Failed to load TypeScript skill from ${filePath}:`, error);
            throw error;
        }
    }

    /**
     * Type guard for Skill objects
     */
    private isSkillObject(obj: unknown): obj is Skill {
        return (
            typeof obj === 'object' &&
            obj !== null &&
            'name' in obj &&
            'displayName' in obj &&
            'description' in obj &&
            'prompt' in obj
        );
    }

    /**
     * Type guard for SkillDefinition objects
     */
    private isSkillDefinition(obj: unknown): obj is SkillDefinition {
        return (
            typeof obj === 'object' &&
            obj !== null &&
            'build' in obj &&
            typeof (obj as SkillDefinition).build === 'function'
        );
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
     * Supports both .md (markdown) and .ts/.js (TypeScript) files
     * @param directoryPath - Path to the directory containing skill files
     * @returns Array of loaded skills
     */
    async loadFromDirectory(directoryPath: string): Promise<Skill[]> {
        const loadedSkills: Skill[] = [];

        try {
            const entries = readdirSync(directoryPath, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = join(directoryPath, entry.name);

                if (entry.isDirectory()) {
                    // Recursively load from subdirectories
                    const subSkills = await this.loadFromDirectory(fullPath);
                    loadedSkills.push(...subSkills);
                } else if (entry.isFile()) {
                    const ext = extname(entry.name);

                    // Load markdown skills
                    if (ext === '.md') {
                        try {
                            const content = readFileSync(fullPath, 'utf-8');
                            const skill = this.loadFromContent(content, fullPath);
                            loadedSkills.push(skill);
                            console.log(`[SkillRegistry] Loaded markdown skill: ${skill.name} from ${fullPath}`);
                        } catch (error) {
                            console.error(`[SkillRegistry] Failed to load markdown skill from ${fullPath}:`, error);
                        }
                    }
                    // Load TypeScript/JavaScript skills
                    else if (ext === '.ts' || ext === '.js') {
                        // Skip test files and type definition files
                        if (entry.name.endsWith('.test.ts') ||
                            entry.name.endsWith('.test.js') ||
                            entry.name.endsWith('.d.ts') ||
                            entry.name.endsWith('.spec.ts') ||
                            entry.name.endsWith('.spec.js')) {
                            continue;
                        }

                        try {
                            const skill = await this.loadFromTypeScriptFile(fullPath);
                            loadedSkills.push(skill);
                            console.log(`[SkillRegistry] Loaded TypeScript skill: ${skill.name} from ${fullPath}`);
                        } catch (error) {
                            console.error(`[SkillRegistry] Failed to load TypeScript skill from ${fullPath}:`, error);
                        }
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
            .filter(s => {
                if (s.type === 'markdown') {
                    return s.parsed?.frontmatter.category === category;
                } else {
                    return s.definition?.getMetadata().category === category;
                }
            })
            .map(s => s.runtime);
    }

    /**
     * Get skills by tag
     */
    getByTag(tag: string): Skill[] {
        return Array.from(this.skills.values())
            .filter(s => {
                if (s.type === 'markdown') {
                    return s.parsed?.frontmatter.tags?.includes(tag);
                } else {
                    return s.definition?.getMetadata().tags?.includes(tag);
                }
            })
            .map(s => s.runtime);
    }

    /**
     * Search skills by query
     */
    search(query: string): Skill[] {
        const lowerQuery = query.toLowerCase();

        return Array.from(this.skills.values())
            .filter(s => {
                const runtime = s.runtime;
                const name = runtime.name.toLowerCase();
                const description = runtime.description.toLowerCase();
                const displayName = runtime.displayName.toLowerCase();

                if (name.includes(lowerQuery) || description.includes(lowerQuery) || displayName.includes(lowerQuery)) {
                    return true;
                }

                // Check tags
                if (s.type === 'markdown') {
                    return s.parsed?.frontmatter.tags?.some((t: string) => t.toLowerCase().includes(lowerQuery));
                } else {
                    return s.definition?.getMetadata().tags?.some((t: string) => t.toLowerCase().includes(lowerQuery));
                }
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
        byType: Record<SkillSourceType, number>;
        categories: Record<string, number>;
        tags: Record<string, number>;
    } {
        const byType: Record<SkillSourceType, number> = { markdown: 0, typescript: 0 };
        const categories: Record<string, number> = {};
        const tags: Record<string, number> = {};

        for (const source of Array.from(this.skills.values())) {
            // Count by type
            byType[source.type as SkillSourceType]++;

            // Get metadata based on type
            let category: string | undefined;
            let skillTags: string[] | undefined;

            if (source.type === 'markdown') {
                category = source.parsed?.frontmatter.category;
                skillTags = source.parsed?.frontmatter.tags;
            } else {
                const metadata = source.definition?.getMetadata();
                category = metadata?.category;
                skillTags = metadata?.tags;
            }

            // Count categories
            if (category) {
                categories[category] = (categories[category] || 0) + 1;
            }

            // Count tags
            for (const tag of skillTags || []) {
                tags[tag] = (tags[tag] || 0) + 1;
            }
        }

        return {
            totalSkills: this.skills.size,
            byType,
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
