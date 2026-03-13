import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import YAML from 'yaml';
import type { ExpertConfig, ExpertComponentDefinition } from '../../types.js';
import { TYPES } from '../../../di/types.js';
import { metaAnalysisArticleRetrievalExportHandler } from './exportHandler.js';
import { metaAnalysisArticleRetrievalInputHandler } from './input.js';

// Get current file directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Expert metadata interface (matches config.json)
 */
interface ExpertMetadataJson {
    id: string;
    displayName: string;
    description?: string;
    category?: string;
    tags?: string[];
    triggers?: string[];
    whenToUse?: string;
}

/**
 * Parameter definition interface (matches sop.yaml)
 */
interface ParameterDefinitionJson {
    name: string;
    type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 's3Key[]';
    required: boolean;
    description: string;
    default?: any;
}

/**
 * Step definition interface
 */
interface StepDefinitionJson {
    phase: string;
    description: string;
    details?: string;
}

/**
 * Example interface
 */
interface ExampleJson {
    input: string;
    output: string;
    description?: string;
}

/**
 * SOP definition interface (matches sop.yaml)
 */
interface SOPDefinitionJson {
    overview: string;
    responsibilities: string[];
    constraints?: string[];
    parameters?: ParameterDefinitionJson[];
    steps: StepDefinitionJson[];
    examples?: ExampleJson[];
}

/**
 * Component definition interface (matches config.json)
 */
interface ComponentDefinitionJson {
    componentId: string;
    displayName: string;
    description: string;
    diToken: string;
    shared?: boolean;
}

/**
 * Expert configuration interface
 */
interface ExpertConfigJson extends ExpertMetadataJson {
    components?: ComponentDefinitionJson[];
}

/**
 * DI Token mapping
 */
const DI_TOKEN_MAP: Record<string, symbol> = {
    'BibliographySearchComponent': TYPES.BibliographySearchComponent
};

/**
 * Load Expert metadata from config.json
 */
function loadMetadata(): ExpertMetadataJson {
    const configPath = join(__dirname, 'config.json');
    const configContent = readFileSync(configPath, 'utf-8');
    return JSON.parse(configContent);
}

/**
 * Load SOP definition from sop.yaml
 */
function loadSOP(): SOPDefinitionJson {
    const sopPath = join(__dirname, 'sop.yaml');
    const sopContent = readFileSync(sopPath, 'utf-8');
    return YAML.parse(sopContent);
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
        instance: DI_TOKEN_MAP[comp.diToken] || comp.diToken,
        shared: comp.shared
    }));
}

/**
 * Meta-Analysis Article Retrieval Expert
 *
 * Factory function that loads configuration from config.json and SOP from sop.yaml
 */
export default function createMetaAnalysisArticleRetrievalExpert(): ExpertConfig {
    const metadata = loadMetadata();
    const sop = loadSOP();

    // Build capability from SOP Overview + Constraints
    const capability = [
        '## Overview\n' + sop.overview,
        sop.constraints?.length ? `## Constraints\n${sop.constraints.map(c => `- ${c}`).join('\n')}` : ''
    ].filter(Boolean).join('\n\n');

    // Build direction from Steps + Examples
    const directionParts: string[] = [];

    if (sop.steps?.length) {
        directionParts.push('## Steps\n');
        for (const step of sop.steps) {
            const phaseName = step.phase.replace(/_/g, ' ');
            directionParts.push(`### Phase: ${phaseName}\n${step.description}`);
            if (step.details) {
                directionParts.push(`\n${step.details}`);
            }
        }
    }

    if (sop.examples?.length) {
        directionParts.push('\n## Examples\n');
        for (const example of sop.examples) {
            directionParts.push(`**Input:**\n\`\`\`\n${example.input}\n\`\`\`\n`);
            directionParts.push(`**Output:**\n\`\`\`\n${example.output}\n\`\`\`\n`);
            if (example.description) {
                directionParts.push(`${example.description}\n`);
            }
        }
    }

    const direction = directionParts.join('\n');

    return {
        expertId: metadata.id,
        displayName: metadata.displayName,
        description: metadata.description || '',
        whenToUse: metadata.whenToUse,
        triggers: metadata.triggers,

        // SOP-based prompt
        prompt: {
            capability,
            direction
        },

        // Responsibilities from SOP
        responsibilities: sop.responsibilities.join('; '),

        // Capabilities from tags
        capabilities: metadata.tags || [],

        // Load components
        components: loadComponents(metadata),

        // Input handler
        input: metaAnalysisArticleRetrievalInputHandler,

        // Export configuration
        exportConfig: {
            autoExport: true,
            bucket: process.env['FS_BUCKET'] || 'agentfs',
            defaultPath: '{expertId}/{timestamp}.csv',
            exportHandler: metaAnalysisArticleRetrievalExportHandler
        }
    };
}
