#!/usr/bin/env node

/**
 * Migration script to convert markdown skills to TypeScript
 *
 * Usage:
 *   node migrate-skills.js <input-dir> <output-dir>
 *   node migrate-skills.js ./repository/builtin ./repository/builtin-ts
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync, statSync } from 'fs';
import { join, extname, basename, dirname } from 'path';
import { SkillLoader } from '../src/skills/SkillLoader.js';

interface MigrationOptions {
    inputDir: string;
    outputDir: string;
    dryRun?: boolean;
}

class SkillMigrator {
    private loader: SkillLoader;

    constructor() {
        this.loader = new SkillLoader();
    }

    /**
     * Migrate all markdown skills in a directory
     */
    migrateDirectory(options: MigrationOptions): void {
        const { inputDir, outputDir, dryRun = false } = options;

        console.log(`Migrating skills from ${inputDir} to ${outputDir}`);
        console.log(`Dry run: ${dryRun}\n`);

        if (!dryRun) {
            mkdirSync(outputDir, { recursive: true });
        }

        this.processDirectory(inputDir, outputDir, dryRun);

        console.log('\nMigration complete!');
    }

    /**
     * Process a directory recursively
     */
    private processDirectory(inputDir: string, outputDir: string, dryRun: boolean): void {
        const entries = readdirSync(inputDir, { withFileTypes: true });

        for (const entry of entries) {
            const inputPath = join(inputDir, entry.name);
            const outputPath = join(outputDir, entry.name);

            if (entry.isDirectory()) {
                if (!dryRun) {
                    mkdirSync(outputPath, { recursive: true });
                }
                this.processDirectory(inputPath, outputPath, dryRun);
            } else if (entry.isFile() && extname(entry.name) === '.md') {
                this.migrateFile(inputPath, outputPath, dryRun);
            }
        }
    }

    /**
     * Migrate a single markdown file to TypeScript
     */
    private migrateFile(inputPath: string, outputPath: string, dryRun: boolean): void {
        try {
            const content = readFileSync(inputPath, 'utf-8');
            const parsed = this.loader.parse(content, inputPath);

            // Generate TypeScript code
            const tsCode = this.generateTypeScriptCode(parsed);

            // Change extension to .ts
            const tsOutputPath = outputPath.replace(/\.md$/, '.skill.ts');

            console.log(`✓ ${basename(inputPath)} -> ${basename(tsOutputPath)}`);

            if (!dryRun) {
                writeFileSync(tsOutputPath, tsCode, 'utf-8');
            }
        } catch (error) {
            console.error(`✗ Failed to migrate ${basename(inputPath)}:`, error);
        }
    }

    /**
     * Generate TypeScript code from parsed skill
     */
    private generateTypeScriptCode(parsed: any): string {
        const { frontmatter, title, capabilities, workDirection, providedTools } = parsed;

        const lines: string[] = [];

        // Imports
        lines.push("import { z } from 'zod';");
        lines.push("import { defineSkill, createTool } from '../../src/skills/SkillDefinition.js';");
        lines.push('');

        // JSDoc comment
        lines.push('/**');
        lines.push(` * ${title}`);
        if (parsed.description) {
            lines.push(' *');
            lines.push(` * ${parsed.description}`);
        }
        lines.push(' */');
        lines.push('');

        // Tool schemas and definitions
        if (providedTools && providedTools.length > 0) {
            lines.push('// Tool schemas');
            for (const tool of providedTools) {
                const schemaName = this.toCamelCase(tool.name) + 'Schema';
                lines.push(`const ${schemaName} = z.object({`);

                for (const param of tool.parameters) {
                    const zodType = this.getZodType(param.type);
                    const optional = param.required ? '' : '.optional()';
                    lines.push(`    ${param.name}: ${zodType}${optional}.describe('${this.escapeString(param.description)}'),`);
                }

                lines.push('});');
                lines.push('');
            }

            lines.push('// Tools');
            lines.push('const tools = [');
            for (const tool of providedTools) {
                const schemaName = this.toCamelCase(tool.name) + 'Schema';
                lines.push('    createTool(');
                lines.push(`        '${tool.name}',`);
                lines.push(`        '${this.escapeString(tool.description)}',`);
                lines.push(`        ${schemaName}`);
                lines.push('    ),');
            }
            lines.push('];');
            lines.push('');
        }

        // Skill definition
        lines.push('export default defineSkill({');
        lines.push(`    name: '${frontmatter.name}',`);
        lines.push(`    displayName: '${title}',`);
        lines.push(`    description: '${this.escapeString(frontmatter.description)}',`);
        lines.push(`    version: '${frontmatter.version}',`);

        if (frontmatter.category) {
            lines.push(`    category: '${frontmatter.category}',`);
        }

        if (frontmatter.tags && frontmatter.tags.length > 0) {
            lines.push(`    tags: [${frontmatter.tags.map((t: string) => `'${t}'`).join(', ')}],`);
        }

        lines.push('');

        // Capabilities
        lines.push('    capabilities: [');
        for (const capability of capabilities) {
            lines.push(`        '${this.escapeString(capability)}',`);
        }
        lines.push('    ],');
        lines.push('');

        // Work direction
        lines.push('    workDirection: `');
        lines.push(workDirection);
        lines.push('    `,');

        // Tools
        if (providedTools && providedTools.length > 0) {
            lines.push('');
            lines.push('    tools,');
        }

        // Lifecycle hooks
        lines.push('');
        lines.push('    onActivate: async () => {');
        lines.push(`        console.log('[${frontmatter.name}] Skill activated');`);
        lines.push('    },');
        lines.push('');
        lines.push('    onDeactivate: async () => {');
        lines.push(`        console.log('[${frontmatter.name}] Skill deactivated');`);
        lines.push('    },');

        // Metadata
        if (parsed.metadata && Object.keys(parsed.metadata).length > 0) {
            lines.push('');
            lines.push('    metadata: {');
            for (const [key, value] of Object.entries(parsed.metadata)) {
                lines.push(`        ${this.toCamelCase(key)}: '${this.escapeString(value as string)}',`);
            }
            lines.push('    }');
        }

        lines.push('});');

        return lines.join('\n');
    }

    /**
     * Convert string to camelCase
     */
    private toCamelCase(str: string): string {
        return str
            .replace(/[-_](.)/g, (_, c) => c.toUpperCase())
            .replace(/^(.)/, (_, c) => c.toLowerCase());
    }

    /**
     * Get Zod type from string type
     */
    private getZodType(type: string): string {
        const lowerType = type.toLowerCase();

        switch (lowerType) {
            case 'string':
                return 'z.string()';
            case 'number':
                return 'z.number()';
            case 'boolean':
                return 'z.boolean()';
            case 'array':
                return 'z.array(z.string())';
            case 'object':
                return 'z.object({}).passthrough()';
            default:
                return 'z.any()';
        }
    }

    /**
     * Escape string for TypeScript
     */
    private escapeString(str: string): string {
        return str
            .replace(/\\/g, '\\\\')
            .replace(/'/g, "\\'")
            .replace(/\n/g, '\\n');
    }
}

// CLI
const args = process.argv.slice(2);

if (args.length < 2) {
    console.error('Usage: node migrate-skills.js <input-dir> <output-dir> [--dry-run]');
    process.exit(1);
}

const [inputDir, outputDir] = args;
const dryRun = args.includes('--dry-run');

const migrator = new SkillMigrator();
migrator.migrateDirectory({
    inputDir,
    outputDir,
    dryRun
});
