/**
 * Meta-Analysis Article Retrieval Expert
 *
 * Factory function that creates ExpertConfig
 *
 * 使用简化架构：
 * - config.json: Expert元数据
 * - sop.md: 标准操作流程（Markdown格式）
 * - Workspace.ts: 工作空间（组件定义）
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
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
 * Load SOP from markdown file
 */
function loadSOP(): string {
    const sopPath = join(__dirname, 'sop.md');
    return readFileSync(sopPath, 'utf-8');
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
 * Factory function that creates ExpertConfig from config.json and sop.md
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

        // SOP - 直接使用markdown内容
        sop,

        // Capabilities
        capabilities: config.tags || [],

        // Components
        components: buildComponents(config),
    };
}
