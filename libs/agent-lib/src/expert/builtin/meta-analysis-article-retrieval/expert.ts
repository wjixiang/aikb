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
 * Split capability.md into responsibilities and capabilities
 * Uses # CAPABILITIES as delimiter
 */
function splitCapabilityContent(content: string): { responsibilities: string; capabilities: string[] } {
    const delimiter = '# CAPABILITIES';
    const parts = content.split(delimiter);

    const responsibilities = parts[0].replace('# RESPONSIBILITIES', '').trim();

    const capabilities = parts[1]
        ? parts[1].split('\n').map(line => line.replace(/^-\s*/, '').trim()).filter(line => line.length > 0)
        : [];

    return { responsibilities, capabilities };
}

/**
 * Meta-Analysis Article Retrieval Expert
 *
 * Factory function that loads configuration and instructions at runtime.
 */
export default function createMetaAnalysisArticleRetrievalExpert(): ExpertConfig {
    const config = loadConfig();

    // Load markdown instructions at runtime
    const capabilityContent = loadInstruction('capability.md');
    const directionContent = loadInstruction('direction.md');

    // Split capability content
    const { responsibilities, capabilities } = splitCapabilityContent(capabilityContent);

    return {
        expertId: config.expertId,
        displayName: config.displayName,
        description: config.description,
        whenToUse: config.whenToUse,
        triggers: config.triggers,

        // Full capability.md as capability prompt
        prompt: {
            capability: capabilityContent,
            direction: directionContent
        },

        responsibilities,
        capabilities,
        components: []
    };
}
