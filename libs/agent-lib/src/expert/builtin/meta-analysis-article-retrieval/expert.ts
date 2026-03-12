import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import type { ExpertConfig, ExpertComponentDefinition } from '../../types.js';
import { TYPES } from '../../../di/types.js';
import { metaAnalysisArticleRetrievalExportHandler } from './exportHandler.js';

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
    category?: string;
    tags?: string[];
    triggers?: string[];
    components?: Array<{
        componentId: string;
        displayName: string;
        description: string;
        diToken: string;
    }>;
}

/**
 * DI Token mapping
 */
const DI_TOKEN_MAP: Record<string, symbol> = {
    'BibliographySearchComponent': TYPES.BibliographySearchComponent
};

/**
 * Load Expert configuration from config.json
 */
function loadConfig(): ExpertConfigJson {
    const configPath = join(__dirname, 'config.json');
    const configContent = readFileSync(configPath, 'utf-8');
    return JSON.parse(configContent);
}

/**
 * Load capability prompt from capability.md
 */
function loadCapability(): string {
    const capabilityPath = join(__dirname, 'capability.md');
    return readFileSync(capabilityPath, 'utf-8');
}

/**
 * Load direction prompt from direction.md
 */
function loadDirection(): string {
    const directionPath = join(__dirname, 'direction.md');
    return readFileSync(directionPath, 'utf-8');
}

/**
 * Load components from config
 */
function loadComponents(config: ExpertConfigJson): ExpertComponentDefinition[] {
    if (!config.components) return [];

    return config.components.map(comp => ({
        componentId: comp.componentId,
        displayName: comp.displayName,
        description: comp.description,
        instance: DI_TOKEN_MAP[comp.diToken]
    }));
}

/**
 * Meta-Analysis Article Retrieval Expert
 *
 * Factory function that loads configuration and markdown files at runtime.
 */
export default function createMetaAnalysisArticleRetrievalExpert(): ExpertConfig {
    const config = loadConfig();

    // Load markdown files directly
    const capability = loadCapability();
    const direction = loadDirection();

    return {
        expertId: config.expertId,
        displayName: config.displayName,
        description: config.description,
        triggers: config.triggers,

        // Direct markdown content as prompt
        prompt: {
            capability,
            direction
        },

        // Extract responsibilities from capability (first section before ## Constraints)
        responsibilities: capability
            .replace(/## Constraints[\s\S]*$/, '')
            .replace(/## Overview\n/, '')
            .trim(),

        // Extract capabilities from tags
        capabilities: config.tags || [],

        // Load components
        components: loadComponents(config),

        // Export configuration
        exportConfig: {
            autoExport: true,
            bucket: process.env['FS_BUCKET'] || 'agentfs',
            defaultPath: '{expertId}/{timestamp}.csv',
            exportHandler: metaAnalysisArticleRetrievalExportHandler
        }
    };
}
