import { z } from 'zod';
import type { Tool, Skill } from './types.js';

/**
 * Markdown Skill Frontmatter Schema
 */
export const skillFrontmatterSchema = z.object({
    name: z.string().describe('Unique skill identifier (kebab-case)'),
    version: z.string().describe('Semantic version'),
    description: z.string().describe('Brief description of the skill'),
    category: z.string().optional().describe('Skill category'),
    tags: z.array(z.string()).optional().describe('Tags for discovery')
});

export type SkillFrontmatter = z.infer<typeof skillFrontmatterSchema>;

/**
 * Parsed tool parameter from markdown
 */
export interface ParsedToolParam {
    name: string;
    type: string;
    required: boolean;
    description: string;
}

/**
 * Parsed tool definition from markdown
 */
export interface ParsedToolDefinition {
    name: string;
    description: string;
    parameters: ParsedToolParam[];
    returns?: ParsedToolParam[] | undefined;
    implementation?: string | undefined;
}

/**
 * Parsed skill from markdown file
 */
export interface ParsedSkill {
    /** Frontmatter metadata */
    frontmatter: SkillFrontmatter;
    /** Skill title from markdown */
    title: string;
    /** Extended description */
    description?: string | undefined;
    /** Capabilities list */
    capabilities: string[];
    /** Work direction/guidance */
    workDirection: string;
    /** Required external tools */
    requiredTools: string[];
    /** Tools provided by this skill */
    providedTools: ParsedToolDefinition[];
    /** Orchestration workflow */
    orchestration?: {
        description: string;
        parameters: ParsedToolParam[];
        workflow?: string | undefined;
    } | undefined;
    /** Helper functions code */
    helperFunctions?: string | undefined;
    /** Test cases */
    testCases: Array<{
        name: string;
        input: unknown;
        expectedOutput: unknown;
    }>;
    /** Additional metadata */
    metadata: Record<string, string>;
    /** Raw markdown content */
    rawContent: string;
    /** Source file path */
    sourcePath?: string | undefined;
}

/**
 * SkillLoader - Parses markdown skill files into structured skill objects
 */
export class SkillLoader {
    /**
     * Parse a markdown skill file content
     */
    parse(content: string, sourcePath?: string): ParsedSkill {
        const { frontmatter, body } = this.parseFrontmatter(content);

        return {
            frontmatter,
            title: this.parseTitle(body),
            description: this.parseDescription(body) ?? undefined,
            capabilities: this.parseCapabilities(body),
            workDirection: this.parseWorkDirection(body),
            requiredTools: this.parseRequiredTools(body),
            providedTools: this.parseProvidedTools(body),
            orchestration: this.parseOrchestration(body) ?? undefined,
            helperFunctions: this.parseHelperFunctions(body) ?? undefined,
            testCases: this.parseTestCases(body),
            metadata: this.parseMetadata(body),
            rawContent: content,
            sourcePath: sourcePath ?? undefined
        };
    }

    /**
     * Parse YAML frontmatter
     */
    private parseFrontmatter(content: string): { frontmatter: SkillFrontmatter; body: string } {
        const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);

        if (!frontmatterMatch) {
            throw new Error('Invalid skill file: missing frontmatter');
        }

        const yamlContent = frontmatterMatch[1] ?? '';
        const body = frontmatterMatch[2] ?? '';

        // Simple YAML parser for frontmatter
        const frontmatter = this.parseYaml(yamlContent);

        // Validate with schema
        const result = skillFrontmatterSchema.safeParse(frontmatter);
        if (!result.success) {
            throw new Error(`Invalid frontmatter: ${result.error.message}`);
        }

        return { frontmatter: result.data, body };
    }

    /**
     * Simple YAML parser for frontmatter
     */
    private parseYaml(yaml: string): Record<string, unknown> {
        const result: Record<string, unknown> = {};
        const lines = yaml.split('\n');

        for (const line of lines) {
            const match = line.match(/^(\w+):\s*(.*)$/);
            if (match) {
                const key = match[1];
                const value = match[2];
                if (key && value !== undefined) {
                    // Handle array syntax [item1, item2]
                    if (value.startsWith('[') && value.endsWith(']')) {
                        result[key] = value
                            .slice(1, -1)
                            .split(',')
                            .map(s => s.trim());
                    } else {
                        result[key] = value.trim();
                    }
                }
            }
        }

        return result;
    }

    /**
     * Parse title (first H1)
     */
    private parseTitle(body: string): string {
        const match = body.match(/^#\s+(.+)$/m);
        return match?.[1]?.trim() ?? '';
    }

    /**
     * Parse description (text after title, before first H2)
     */
    private parseDescription(body: string): string | null {
        const match = body.match(/^#\s+.+\n\n([\s\S]*?)(?=\n##\s|$)/);
        if (match?.[1]) {
            const desc = match[1].trim();
            return desc || null;
        }
        return null;
    }

    /**
     * Parse capabilities section
     */
    private parseCapabilities(body: string): string[] {
        const section = this.extractSection(body, 'Capabilities');
        if (!section) return [];

        const items: string[] = [];
        const lines = section.split('\n');

        for (const line of lines) {
            const match = line.match(/^-\s+(.+)$/);
            if (match?.[1]) {
                items.push(match[1].trim());
            }
        }

        return items;
    }

    /**
     * Parse work direction section
     */
    private parseWorkDirection(body: string): string {
        return this.extractSection(body, 'Work Direction') ?? '';
    }

    /**
     * Parse required tools section
     */
    private parseRequiredTools(body: string): string[] {
        const section = this.extractSection(body, 'Required Tools');
        if (!section) return [];

        const tools: string[] = [];
        const lines = section.split('\n');

        for (const line of lines) {
            const match = line.match(/^-\s+`([^`]+)`/);
            if (match?.[1]) {
                tools.push(match[1]);
            }
        }

        return tools;
    }

    /**
     * Parse provided tools section
     */
    private parseProvidedTools(body: string): ParsedToolDefinition[] {
        const section = this.extractSection(body, 'Provided Tools');
        if (!section) return [];

        const tools: ParsedToolDefinition[] = [];

        // Split by H3 headers (### tool_name)
        const toolSections = section.split(/\n###\s+/).slice(1);

        for (const toolSection of toolSections) {
            const tool = this.parseToolDefinition(toolSection);
            if (tool) {
                tools.push(tool);
            }
        }

        return tools;
    }

    /**
     * Parse a single tool definition
     */
    private parseToolDefinition(section: string): ParsedToolDefinition | null {
        const lines = section.split('\n');
        const name = lines[0]?.trim();

        if (!name) return null;

        // Get description (text before **Parameters:**)
        const descMatch = section.match(/^[^\n]+\n\n([\s\S]*?)(?=\n\*\*Parameters|\n\*\*Returns|$)/);
        const description = descMatch?.[1]?.trim() ?? '';

        // Parse parameters
        const paramsMatch = section.match(/\*\*Parameters:\*\*\n([\s\S]*?)(?=\n\*\*Returns|\n\*\*Implementation|$)/);
        const parameters = paramsMatch?.[1] ? this.parseParams(paramsMatch[1]) : [];

        // Parse returns
        const returnsMatch = section.match(/\*\*Returns:\*\*\n([\s\S]*?)(?=\n\*\*Implementation|$)/);
        const returns = returnsMatch?.[1] ? this.parseParams(returnsMatch[1]) : undefined;

        // Parse implementation
        const implMatch = section.match(/\*\*Implementation:\*\*\n\n```typescript\n([\s\S]*?)```/);
        const implementation = implMatch?.[1]?.trim() ?? undefined;

        return {
            name,
            description,
            parameters,
            returns,
            implementation
        };
    }

    /**
     * Parse parameter list
     */
    private parseParams(content: string): ParsedToolParam[] {
        const params: ParsedToolParam[] = [];
        const lines = content.split('\n');

        for (const line of lines) {
            // Match: - `name` (type, required/optional): description
            const match = line.match(/^-\s+`([^`]+)`\s+\(([^,]+),\s*(required|optional)\):\s*(.+)$/);
            if (match) {
                const name = match[1];
                const type = match[2];
                const required = match[3];
                const description = match[4];
                if (name && type && required && description) {
                    params.push({
                        name,
                        type: type.trim(),
                        required: required === 'required',
                        description: description.trim()
                    });
                }
            }
        }

        return params;
    }

    /**
     * Parse orchestration section
     */
    private parseOrchestration(body: string): ParsedSkill['orchestration'] | null {
        const section = this.extractSection(body, 'Orchestration');
        if (!section) return null;

        // Get description
        const descMatch = section.match(/^([\s\S]*?)(?=\n\*\*Parameters|$)/);
        const description = descMatch?.[1]?.trim() ?? '';

        // Parse parameters
        const paramsMatch = section.match(/\*\*Parameters:\*\*\n([\s\S]*?)(?=\n\*\*Workflow|$)/);
        const parameters = paramsMatch?.[1] ? this.parseParams(paramsMatch[1]) : [];

        // Parse workflow
        const workflowMatch = section.match(/\*\*Workflow:\*\*\n\n```typescript\n([\s\S]*?)```/);
        const workflow = workflowMatch?.[1]?.trim() ?? undefined;

        return { description, parameters, workflow };
    }

    /**
     * Parse helper functions section
     */
    private parseHelperFunctions(body: string): string | null {
        const section = this.extractSection(body, 'Helper Functions');
        if (!section) return null;

        const match = section.match(/```typescript\n([\s\S]*?)```/);
        return match?.[1]?.trim() ?? null;
    }

    /**
     * Parse test cases section
     */
    private parseTestCases(body: string): ParsedSkill['testCases'] {
        const section = this.extractSection(body, 'Test Cases');
        if (!section) return [];

        const testCases: ParsedSkill['testCases'] = [];

        // Split by H3 headers
        const caseSections = section.split(/\n###\s+/).slice(1);

        for (const caseSection of caseSections) {
            const nameMatch = caseSection.match(/^([^\n]+)/);
            const name = nameMatch?.[1]?.trim() ?? 'Unknown';

            const inputMatch = caseSection.match(/\*\*Input:\*\*\n```json\n([\s\S]*?)```/);
            const outputMatch = caseSection.match(/\*\*Expected Output:\*\*\n```json\n([\s\S]*?)```/);

            try {
                testCases.push({
                    name,
                    input: inputMatch?.[1] ? JSON.parse(inputMatch[1]) : {},
                    expectedOutput: outputMatch?.[1] ? JSON.parse(outputMatch[1]) : {}
                });
            } catch {
                // Skip invalid JSON
            }
        }

        return testCases;
    }

    /**
     * Parse metadata section
     */
    private parseMetadata(body: string): Record<string, string> {
        const section = this.extractSection(body, 'Metadata');
        if (!section) return {};

        const metadata: Record<string, string> = {};
        const lines = section.split('\n');

        for (const line of lines) {
            const match = line.match(/^-\s+\*\*([^*]+)\*\*:\s*(.+)$/);
            if (match) {
                const key = match[1]?.trim();
                const value = match[2]?.trim();
                if (key && value) {
                    metadata[key] = value;
                }
            }
        }

        return metadata;
    }

    /**
     * Extract a section by H2 header name
     */
    private extractSection(body: string, sectionName: string): string | null {
        const regex = new RegExp(`##\\s+${sectionName}\\n\\n([\\s\\S]*?)(?=\\n##\\s|$)`, 'i');
        const match = body.match(regex);
        return match?.[1]?.trim() ?? null;
    }

    /**
     * Convert parsed skill to runtime Skill object
     */
    toRuntimeSkill(parsed: ParsedSkill): Skill {
        const tools = this.buildTools(parsed);

        return {
            name: parsed.frontmatter.name,
            displayName: parsed.title,
            description: parsed.frontmatter.description,
            triggers: parsed.frontmatter.tags,
            prompt: {
                capability: parsed.capabilities.length > 0
                    ? `You have the following capabilities:\n${parsed.capabilities.map(c => `- ${c}`).join('\n')}`
                    : '',
                direction: parsed.workDirection
            },
            tools,
            onActivate: async () => {
                console.log(`[Skill] ${parsed.frontmatter.name} activated`);
            },
            onDeactivate: async () => {
                console.log(`[Skill] ${parsed.frontmatter.name} deactivated`);
            }
        };
    }

    /**
     * Build Tool objects from parsed tool definitions
     */
    private buildTools(parsed: ParsedSkill): Tool[] | undefined {
        if (parsed.providedTools.length === 0) {
            return undefined;
        }

        return parsed.providedTools.map(toolDef => ({
            toolName: `${parsed.frontmatter.name}__${toolDef.name}`,
            desc: toolDef.description,
            paramsSchema: this.buildParamsSchema(toolDef.parameters)
        }));
    }

    /**
     * Build Zod schema from parsed parameters
     */
    private buildParamsSchema(params: ParsedToolParam[]): z.ZodType<unknown> {
        const shape: Record<string, z.ZodTypeAny> = {};

        for (const param of params) {
            let schema: z.ZodTypeAny;

            switch (param.type.toLowerCase()) {
                case 'string':
                    schema = z.string();
                    break;
                case 'number':
                    schema = z.number();
                    break;
                case 'boolean':
                    schema = z.boolean();
                    break;
                case 'array':
                    schema = z.array(z.any());
                    break;
                case 'object':
                    schema = z.object({}).passthrough();
                    break;
                default:
                    schema = z.any();
            }

            schema = schema.describe(param.description);

            if (!param.required) {
                schema = schema.optional();
            }

            shape[param.name] = schema;
        }

        return z.object(shape);
    }
}
