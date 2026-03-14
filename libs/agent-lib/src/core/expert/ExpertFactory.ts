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
    InputHandler,
    ExportConfig,
    ExportResult
} from './types.js';
import { VirtualWorkspace } from '../statefulContext/virtualWorkspace.js';
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
    export?: ExportConfigJson;
}

/**
 * 导出配置JSON接口
 */
interface ExportConfigJson {
    autoExport?: boolean;
    bucket?: string;
    defaultPath?: string;
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

    if (sop.constraints?.length) {
        parts.push('## Constraints\n' + sop.constraints.map(c => `- ${c}`).join('\n'));
    }

    return parts.join('\n\n');
}

/**
 * 构建Direction Prompt
 */
function buildDirection(sop: SOPDefinitionJson): string {
    const parts: string[] = [];

    // Steps
    if (sop.steps?.length) {
        parts.push('## Steps\n');
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

        // 输入处理（从Workspace获取）
        input: workspace.getInputHandler(),

        // 导出配置（从Workspace获取）
        exportConfig: config.export ? {
            autoExport: config.export.autoExport,
            bucket: config.export.bucket,
            defaultPath: config.export.defaultPath,
            exportHandler: (ws: VirtualWorkspace, cfg: ExportConfig) =>
                workspace.exportHandler(ws, cfg),
        } : undefined,
    };
}

