/**
 * Expert Factory - 简化Expert创建的工具函数
 *
 * 自动加载config.json和sop.yaml，减少样板代码
 *
 * 使用方式：
 * ```typescript
 * // index.ts
 * import { createExpertConfig } from '../../ExpertFactory.js';
 * import { MyExpertWorkspace } from './Workspace.js';
 *
 * export default createExpertConfig(import.meta.url, MyExpertWorkspace);
 * ```
 *
 * 组件定义：
 * 在 Workspace.ts 中通过重写 getComponents() 方法定义组件
 * ```typescript
 * class MyExpertWorkspace extends ExpertWorkspaceBase {
 *   static override getComponents() {
 *     return [
 *       new MyComponent(),           // 直接实例
 *       () => new AnotherComponent(), // 工厂函数
 *     ];
 *   }
 * }
 * ```
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import YAML from 'yaml';
import type {
    ExpertConfig,
    ExpertComponentDefinition,
} from './types.js';
import type { VirtualWorkspaceConfig } from '../../components/index.js';
import { ExpertWorkspaceBase } from './ExpertWorkspaceBase.js';

/**
 * Expert配置JSON接口
 * 注意：components 字段已移除，组件应在 Workspace.ts 中定义
 */
interface ExpertConfigJson {
    id: string;
    displayName: string;
    description?: string;
    version?: string;
    category?: string;
    tags?: string[];
    triggers?: string[];
    whenToUse?: string;
    /**
     * VirtualWorkspace 配置
     * 支持从 config.json 配置以下选项：
     * - renderMode: 'tui' | 'markdown' (默认: 'markdown')
     * - toolCallLogCount: number (默认: 3, 设为0禁用)
     */
    virtualWorkspace?: {
        renderMode?: 'tui' | 'markdown';
        toolCallLogCount?: number;
    };
}

/**
 * SOP YAML接口
 */
interface SOPDefinitionJson {
    overview: string;
    responsibilities?: string[];
    constraints?: string[];
    parameters?: ParameterDefinitionJson[];
    steps?: StepDefinitionJson[];
    examples?: ExampleJson[];
    // Extended SOP fields
    searchStrategy?: {
        thinking?: { description?: string; details?: string };
        action?: { description?: string; details?: string };
        output?: { description?: string; details?: string };
    };
    picoGuide?: {
        description?: string;
        population?: string;
        intervention?: string;
        comparison?: string;
        outcome?: string;
        studyTypes?: string[];
    };
    commonFilters?: {
        studyDesign?: string[];
        language?: string[];
        dateRange?: string[];
        availability?: string[];
        species?: string[];
    };
    errorHandling?: {
        noResults?: string[];
        tooManyResults?: string[];
        apiErrors?: string[];
    };
}

/**
 * 参数定义接口
 */
interface ParameterDefinitionJson {
    name: string;
    type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 's3Key[]';
    required: boolean;
    description: string;
    default?: any;
}

/**
 * 步骤定义接口
 */
interface StepDefinitionJson {
    phase: string;
    description: string;
    details?: string;
}

/**
 * 示例接口
 */
interface ExampleJson {
    input: string;
    output: string;
    description?: string;
}

/**
 * 加载JSON配置文件
 */
function loadConfig(configPath: string): ExpertConfigJson {
    const content = readFileSync(configPath, 'utf-8');
    return JSON.parse(content);
}

/**
 * 加载SOP YAML文件
 */
function loadSOP(sopPath: string): SOPDefinitionJson {
    const content = readFileSync(sopPath, 'utf-8');
    return YAML.parse(content);
}

/**
 * 构建Capability Prompt
 */
function buildCapability(sop: SOPDefinitionJson): string {
    const parts: string[] = [];

    parts.push('## Overview\n' + sop.overview);

    if (sop.responsibilities?.length) {
        parts.push('\n## Responsibilities\n' + sop.responsibilities.map(r => `- ${r}`).join('\n'));
    }

    if (sop.constraints?.length) {
        parts.push('\n## Constraints\n' + sop.constraints.map(c => `- ${c}`).join('\n'));
    }

    return parts.join('\n');
}

/**
 * 构建Direction Prompt
 */
function buildDirection(sop: SOPDefinitionJson): string {
    const parts: string[] = [];

    // Search Strategy (thinking, action, output phases)
    if (sop.searchStrategy) {
        parts.push('## Search Strategy\n');
        const { thinking, action, output } = sop.searchStrategy;

        if (thinking) {
            parts.push(`### Thinking Phase\n${thinking.description || ''}`);
            if (thinking.details) {
                parts.push(`\n${thinking.details}`);
            }
        }

        if (action) {
            parts.push(`\n### Action Phase\n${action.description || ''}`);
            if (action.details) {
                parts.push(`\n${action.details}`);
            }
        }

        if (output) {
            parts.push(`\n### Output Phase\n${output.description || ''}`);
            if (output.details) {
                parts.push(`\n${output.details}`);
            }
        }
    }

    // PICO Guide
    if (sop.picoGuide) {
        parts.push('\n## PICO Guide\n');
        const { description, population, intervention, comparison, outcome, studyTypes } = sop.picoGuide;

        if (description) {
            parts.push(`${description}\n`);
        }

        if (population) {
            parts.push(`**Population (P):** ${population}\n`);
        }
        if (intervention) {
            parts.push(`**Intervention (I):** ${intervention}\n`);
        }
        if (comparison) {
            parts.push(`**Comparison (C):** ${comparison}\n`);
        }
        if (outcome) {
            parts.push(`**Outcome (O):** ${outcome}\n`);
        }
        if (studyTypes?.length) {
            parts.push(`\n**Study Types:**\n${studyTypes.map(t => `- ${t}`).join('\n')}\n`);
        }
    }

    // Common Filters
    if (sop.commonFilters) {
        parts.push('\n## Common Filters\n');
        const { studyDesign, language, dateRange, availability, species } = sop.commonFilters;

        if (studyDesign?.length) {
            parts.push(`**Study Design:**\n${studyDesign.map(f => `- ${f}`).join('\n')}\n`);
        }
        if (language?.length) {
            parts.push(`**Language:**\n${language.map(f => `- ${f}`).join('\n')}\n`);
        }
        if (dateRange?.length) {
            parts.push(`**Date Range:**\n${dateRange.map(f => `- ${f}`).join('\n')}\n`);
        }
        if (availability?.length) {
            parts.push(`**Availability:**\n${availability.map(f => `- ${f}`).join('\n')}\n`);
        }
        if (species?.length) {
            parts.push(`**Species:**\n${species.map(f => `- ${f}`).join('\n')}\n`);
        }
    }

    // Error Handling
    if (sop.errorHandling) {
        parts.push('\n## Error Handling\n');
        const { noResults, tooManyResults, apiErrors } = sop.errorHandling;

        if (noResults?.length) {
            parts.push(`**No Results:**\n${noResults.map(e => `- ${e}`).join('\n')}\n`);
        }
        if (tooManyResults?.length) {
            parts.push(`**Too Many Results:**\n${tooManyResults.map(e => `- ${e}`).join('\n')}\n`);
        }
        if (apiErrors?.length) {
            parts.push(`**API Errors:**\n${apiErrors.map(e => `- ${e}`).join('\n')}\n`);
        }
    }

    // Steps (legacy/additional)
    if (sop.steps?.length) {
        parts.push('\n## Workflow Steps\n');
        for (const step of sop.steps) {
            const phaseName = step.phase.replace(/_/g, ' ');
            parts.push(`### Phase: ${phaseName}\n${step.description}`);
            if (step.details) {
                parts.push(`\n${step.details}`);
            }
        }
    }

    // Examples
    if (sop.examples?.length) {
        parts.push('\n## Examples\n');
        for (const example of sop.examples) {
            if (example.description) {
                parts.push(`**${example.description}**\n`);
            }
            parts.push(`**Input:**\n\`\`\`\n${example.input}\n\`\`\``);
            parts.push(`**Output:**\n\`\`\`\n${example.output}\n\`\`\`\n`);
        }
    }

    return parts.join('\n');
}

/**
 * 构建组件定义
 *
 * 从 Workspace.getComponents() 或 Workspace.getComponentsWithIds() 获取组件
 * 移除对 config.json 中 components 字段的依赖
 */
function buildComponents(
    workspace: typeof ExpertWorkspaceBase
): ExpertComponentDefinition[] {
    // 优先使用 getComponentsWithIds（如果子类重写了）
    if (typeof workspace.getComponentsWithIds === 'function') {
        const componentsWithIds = workspace.getComponentsWithIds();
        if (componentsWithIds && componentsWithIds.length > 0) {
            return componentsWithIds.map(def => ({
                componentId: def.id,
                displayName: def.id,
                description: '',
                instance: def.component,
            }));
        }
    }

    // 使用 getComponents
    const components = workspace.getComponents();
    if (!components || components.length === 0) {
        return [];
    }

    return components.map((comp, index) => ({
        componentId: `component-${index}`,
        displayName: `component-${index}`,
        description: '',
        instance: comp,
    }));
}

/**
 * 创建Expert配置
 *
 * 这是主要的工厂函数，自动加载配置文件并生成ExpertConfig
 *
 * @param metaUrl - import.meta.url（用于定位配置文件路径）
 * @param workspace - VirtualWorkspace子类或ExpertWorkspaceBase命名空间
 * @returns ExpertConfig
 *
 * @example
 * ```typescript
 * // index.ts
 * import { createExpertConfig } from '../../ExpertFactory.js';
 * import { MyExpertWorkspace } from './Workspace.js';
 *
 * export default createExpertConfig(import.meta.url, MyExpertWorkspace);
 * ```
 */
export function createExpertConfig(
    metaUrl: string,
    workspace: typeof ExpertWorkspaceBase
): ExpertConfig {
    // 获取当前Expert目录
    const __filename = fileURLToPath(metaUrl);
    const __dirname = dirname(__filename);

    // 加载配置文件
    const config = loadConfig(join(__dirname, 'config.json'));
    const sop = loadSOP(join(__dirname, 'sop.yaml'));

    return {
        // 基本信息
        expertId: config.id,
        displayName: config.displayName,
        description: config.description || '',
        whenToUse: config.whenToUse,
        triggers: config.triggers,

        // Prompt（从SOP自动构建）
        prompt: {
            capability: buildCapability(sop),
            direction: buildDirection(sop),
        },

        // 职责和能力
        responsibilities: sop.responsibilities?.join('; ') || '',
        capabilities: config.tags || [],

        // 组件（从 Workspace 获取）
        components: buildComponents(workspace),

        // VirtualWorkspace 配置（从 config.json 的 virtualWorkspace 字段读取）
        // 注意：ExpertExecutor 中还会覆盖 id 和 name，但 renderMode、toolCallLogCount 等会使用这里的值
        virtualWorkspaceConfig: config.virtualWorkspace as VirtualWorkspaceConfig | undefined,
    };
}

