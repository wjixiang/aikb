/**
 * Expert Factory - 简化Expert创建的工具函数
 *
 * 自动加载config.json和sop.yaml（或sop.md），减少样板代码
 * 支持结构化SOP（YAML）和传统Markdown SOP
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

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import type {
    ExpertConfig,
    ExpertComponentDefinition,
} from './types.js';
import type { VirtualWorkspaceConfig, ExportConfig } from '../../components/index.js';
import { ExpertWorkspaceBase } from './ExpertWorkspaceBase.js';

/**
 * SOP YAML 结构
 */
interface SOPYaml {
    overview?: string;
    responsibilities?: string[];
    constraints?: string[];
    parameters?: Array<{
        name: string;
        type: string;
        required?: boolean;
        description?: string;
    }>;
    steps?: Array<{
        phase: string;
        description: string;
        details?: string;
    }>;
    examples?: Array<{
        input?: string;
        output?: string;
        description?: string;
    }>;
}

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
    /**
     * 导出配置
     */
    export?: {
        autoExport?: boolean;
        bucket?: string;
        defaultPath?: string;
    };
}

/**
 * 加载JSON配置文件
 */
function loadConfig(configPath: string): ExpertConfigJson {
    const content = readFileSync(configPath, 'utf-8');
    return JSON.parse(content);
}

/**
 * 加载并解析SOP YAML文件
 * SOP YAML格式支持结构化的steps、parameters、examples
 */
function loadSOPYaml(sopPath: string): SOPYaml | null {
    if (!existsSync(sopPath)) {
        return null;
    }
    try {
        // Dynamic import for yaml parsing
        const YAML = require('yaml');
        const content = readFileSync(sopPath, 'utf-8');
        return YAML.parse(content) as SOPYaml;
    } catch {
        return null;
    }
}

/**
 * 加载SOP Markdown文件（传统格式）
 */
function loadSOPMarkdown(sopPath: string): string | null {
    if (!existsSync(sopPath)) {
        return null;
    }
    return readFileSync(sopPath, 'utf-8');
}

/**
 * 构建Capability Prompt（能力描述）
 */
function buildCapability(sop: SOPYaml): string {
    const parts: string[] = [];

    if (sop.overview) {
        parts.push(`## Overview\n${sop.overview}`);
    }

    if (sop.responsibilities?.length) {
        parts.push(`## Responsibilities\n${sop.responsibilities.map(r => `- ${r}`).join('\n')}`);
    }

    if (sop.constraints?.length) {
        parts.push(`## Constraints\n${sop.constraints.map(c => `- ${c}`).join('\n')}`);
    }

    return parts.join('\n\n');
}

/**
 * 构建Direction Prompt（方向指导）
 */
function buildDirection(sop: SOPYaml): string {
    const parts: string[] = [];

    if (sop.steps?.length) {
        parts.push('## Steps\n');
        for (const step of sop.steps) {
            parts.push(`### ${step.phase}\n${step.description}`);
            if (step.details) {
                parts.push(`\n${step.details}`);
            }
        }
    }

    if (sop.examples?.length) {
        parts.push('\n## Examples\n');
        for (const example of sop.examples) {
            if (example.input) {
                parts.push(`**Input:**\n\`\`\`\n${example.input}\n\`\`\``);
            }
            if (example.output) {
                parts.push(`**Output:**\n\`\`\`\n${example.output}\n\`\`\``);
            }
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
 * 优先使用 sop.yaml（结构化），如果不存在则降级到 sop.md（Markdown）
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

    // 尝试加载SOP YAML（结构化格式），如果不存在则降级到Markdown
    const sopYamlPath = join(__dirname, 'sop.yaml');
    const sopMdPath = join(__dirname, 'sop.md');

    const sopYaml = loadSOPYaml(sopYamlPath);
    const sopMarkdown = loadSOPMarkdown(sopMdPath);

    // 确定使用哪个SOP格式
    const useYaml = sopYaml !== null;
    const sopContent = useYaml ? null : sopMarkdown;

    if (!useYaml && !sopMarkdown) {
        throw new Error(`Neither sop.yaml nor sop.md found in ${__dirname}`);
    }

    return {
        // 基本信息
        expertId: config.id,
        displayName: config.displayName,
        description: config.description || '',
        whenToUse: config.whenToUse,
        triggers: config.triggers,

        // SOP处理：YAML格式使用capability/direction，Markdown直接使用
        sop: useYaml ? '' : sopContent!,

        // 结构化SOP的capability和direction（仅YAML格式）
        prompt: useYaml ? {
            capability: buildCapability(sopYaml!),
            direction: buildDirection(sopYaml!),
        } : undefined,

        // 职责（从YAML的responsibilities获取）
        responsibilities: useYaml && sopYaml?.responsibilities
            ? sopYaml.responsibilities.join('; ')
            : '',

        // 能力标签
        capabilities: config.tags || [],

        // 组件（从 Workspace 获取）
        components: buildComponents(workspace),

        // VirtualWorkspace 配置（从 config.json 的 virtualWorkspace 字段读取）
        virtualWorkspaceConfig: config.virtualWorkspace as VirtualWorkspaceConfig | undefined,

        // 输入处理（从 Workspace 获取）
        input: {
            validate: workspace.validateInput,
            transform: (input: Record<string, any>) => {
                const result = workspace.transformInput(input);
                return result.data;
            },
            loadExternalData: workspace.loadExternalData,
        },

        // 导出配置
        exportConfig: config.export ? {
            autoExport: config.export.autoExport ?? false,
            bucket: config.export.bucket ?? 'agentfs',
            defaultPath: config.export.defaultPath ?? '{expertId}/{timestamp}.json',
        } : undefined,
    };
}
