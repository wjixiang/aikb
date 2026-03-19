/**
 * Meta-Analysis Article Retrieval Expert
 *
 * Factory function that creates ExpertConfig
 *
 * 使用简化架构：
 * - config.json: Expert元数据
 * - sop.yaml: 标准操作流程
 * - Workspace.ts: 工作空间（组件定义）
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import YAML from 'yaml';
import type { ExpertConfig, ExpertComponentDefinition } from '../../types.js';
import { TYPES } from '../../../di/types.js';

// Get current file directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Load Expert metadata from config.json
 */
function loadConfig() {
    const configPath = join(__dirname, 'config.json');
    return JSON.parse(readFileSync(configPath, 'utf-8'));
}

/**
 * Load SOP definition from sop.yaml
 */
function loadSOP() {
    const sopPath = join(__dirname, 'sop.yaml');
    return YAML.parse(readFileSync(sopPath, 'utf-8'));
}

/**
 * Build Capability Prompt from SOP
 */
function buildCapability(sop: any): string {
    const parts: string[] = [];

    parts.push('## Overview\n' + sop.overview);

    if (sop.constraints?.length) {
        parts.push('## Constraints\n' + sop.constraints.map((c: string) => `- ${c}`).join('\n'));
    }

    return parts.join('\n\n');
}

/**
 * Build Direction Prompt from SOP
 */
function buildDirection(sop: any): string {
    const parts: string[] = [];

    // Steps
    if (sop.steps?.length) {
        parts.push('## Steps\n');
        for (const step of sop.steps) {
            parts.push(`### ${step.phase}\n${step.description}`);
            if (step.details) {
                parts.push(`\n${step.details}`);
            }
        }
    }

    // Examples
    if (sop.examples?.length) {
        parts.push('\n## Examples\n');
        for (const example of sop.examples) {
            parts.push(`**Input:**\n\`\`\`\n${example.input}\n\`\`\``);
            parts.push(`**Output:**\n\`\`\`\n${example.output}\n\`\`\``);
            if (example.description) {
                parts.push(example.description);
            }
        }
    }

    return parts.join('\n');
}

/**
 * Build Component Definitions
 */
function buildComponents(config: any): ExpertComponentDefinition[] {
    return (config.components || []).map((comp: any) => ({
        componentId: comp.id || comp.componentId,
        displayName: comp.displayName,
        description: comp.description,
        instance: TYPES[comp.diToken as keyof typeof TYPES] || comp.diToken,
        shared: comp.shared,
    }));
}

/**
 * Create Expert Configuration
 *
 * Factory function that creates ExpertConfig from config.json and sop.yaml
 */
export default function createMetaAnalysisArticleRetrievalExpert(): ExpertConfig {
    const config = loadConfig();
    const sop = loadSOP();

    return {
        // Basic metadata
        expertId: config.id,
        displayName: config.displayName,
        description: config.description || '',
        whenToUse: config.whenToUse,
        triggers: config.triggers,

        // Prompt (built from SOP)
        prompt: {
            capability: buildCapability(sop),
            direction: buildDirection(sop),
        },

        // Responsibilities and capabilities
        responsibilities: sop.responsibilities?.join('; ') || '',
        capabilities: config.tags || [],

        // Components
        components: buildComponents(config),
    };
}
