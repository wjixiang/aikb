/**
 * Expert Factory - 简化Expert创建的工具函数
 *
 * 自动加载config.json和sop.md，减少样板代码
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
 * 加载JSON配置文件
 */
function loadConfig(configPath: string): ExpertConfigJson {
    const content = readFileSync(configPath, 'utf-8');
    return JSON.parse(content);
}

/**
 * 加载SOP Markdown文件
 * SOP is stored as plain markdown text
 */
function loadSOP(sopPath: string): string {
    return readFileSync(sopPath, 'utf-8');
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

    // 加载配置文件和SOP
    const config = loadConfig(join(__dirname, 'config.json'));
    const sop = loadSOP(join(__dirname, 'sop.md'));

    return {
        // 基本信息
        expertId: config.id,
        displayName: config.displayName,
        description: config.description || '',
        whenToUse: config.whenToUse,
        triggers: config.triggers,

        // SOP - 直接使用markdown内容
        sop,

        // 职责（可选）
        responsibilities: '',

        // 能力标签
        capabilities: config.tags || [],

        // 组件（从 Workspace 获取）
        components: buildComponents(workspace),

        // VirtualWorkspace 配置（从 config.json 的 virtualWorkspace 字段读取）
        // 注意：ExpertExecutor 中还会覆盖 id 和 name，但 renderMode、toolCallLogCount 等会使用这里的值
        virtualWorkspaceConfig: config.virtualWorkspace as VirtualWorkspaceConfig | undefined,
    };
}
