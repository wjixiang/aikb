import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import type { ExpertConfig } from '../../types.js';

// Get current file directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Expert configuration interface (matches config.json)
 */
interface ExpertConfigJson {
    expertId: string;
    displayName: string;
    description: string;
    whenToUse?: string;
    version: string;
    category?: string;
    tags?: string[];
    triggers?: string[];
    metadata?: Record<string, string>;
}

/**
 * Load Expert configuration from config.json
 */
function loadConfig(): ExpertConfigJson {
    const configPath = join(__dirname, 'config.json');
    const configContent = readFileSync(configPath, 'utf-8');
    return JSON.parse(configContent);
}

/**
 * Load instruction content from markdown file
 */
function loadInstruction(filename: string): string {
    const filePath = join(__dirname, filename);
    return readFileSync(filePath, 'utf-8');
}

/**
 * Extract responsibilities section from capability.md
 */
function extractResponsibilities(content: string): string {
    const match = content.match(/## Responsibilities\n([\s\S]*?)(?=##|$)/i);
    return match ? match[1].trim() : '';
}

/**
 * Extract capabilities list from capability.md
 */
function extractCapabilities(content: string): string[] {
    const match = content.match(/## Capabilities\n([\s\S]*?)(?=##|$)/i);
    if (!match) return [];

    return match[1]
        .split('\n')
        .map(line => line.replace(/^-\s*/, '').trim())
        .filter(line => line.length > 0);
}

/**
 * Meta-Analysis Article Retrieval Expert
 *
 * Factory function that loads configuration and instructions at runtime.
 * Uses fs.readFile to load markdown and JSON files.
 */
export default function createMetaAnalysisArticleRetrievalExpert(): ExpertConfig {
    const config = loadConfig();

    // Load markdown instructions at runtime
    const capabilityContent = loadInstruction('capability.md');
    const directionContent = loadInstruction('direction.md');

    return {
        expertId: config.expertId,
        displayName: config.displayName,
        description: config.description,
        whenToUse: config.whenToUse,
        triggers: config.triggers,

        // Prompt loaded from markdown files at runtime
        prompt: {
            capability: capabilityContent,
            direction: directionContent
        },

        // Extract responsibilities and capabilities from markdown
        responsibilities: extractResponsibilities(capabilityContent),
        capabilities: extractCapabilities(capabilityContent),

        components: []
    };
}
