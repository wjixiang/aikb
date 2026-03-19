/**
 * ExpertWorkspaceBase - Expert Workspace 基类
 *
 * 提供通用的输入/输出处理功能，简化Expert开发
 * 用于 createExpertConfig 工厂函数
 *
 * 使用方式：
 * ```typescript
 * import { ExpertWorkspaceBase } from 'agent-lib';
 *
 * class MyExpertWorkspace extends ExpertWorkspaceBase {
 *   static override getComponents() { ... }
 *   static override validateInput() { ... }
 * }
 * ```
 */

import { ToolComponent } from '../../components/core/toolComponent.js';
import { VirtualWorkspace } from '../statefulContext/virtualWorkspace.js';
import type { ValidationResult } from './types.js';

/**
 * 组件定义类型
 * 支持直接实例、工厂函数、异步工厂函数
 */
export type ComponentFactory = ToolComponent | (() => ToolComponent) | (() => Promise<ToolComponent>);

/**
 * 组件定义（含ID）
 */
export interface ComponentDefinition {
    id: string;
    component: ComponentFactory;
}

/**
 * Expert Workspace 基类
 *
 * 提供静态方法用于 createExpertConfig 工厂函数
 * 定义组件列表、输入验证、输出格式化等
 */
export abstract class ExpertWorkspaceBase {

    // ==================== 组件管理 ====================

    /**
     * 获取组件列表
     * 子类必须实现此方法以定义 Expert 使用的组件
     *
     * @returns 组件实例数组、工厂函数数组或两者混合
     *
     * @example
     * ```typescript
     * static override getComponents() {
     *   return [
     *     new BibliographySearchComponent(),           // 直接实例
     *     () => new VirtualFileSystemComponent(),     // 同步工厂函数
     *     async () => await createComponent(),        // 异步工厂函数
     *   ];
     * }
     * ```
     *
     * @example
     * ```typescript
     * // 带ID的组件定义
     * static override getComponentsWithIds() {
     *   return [
     *     { id: 'search', component: new BibliographySearchComponent() },
     *     { id: 'vfs', component: () => new VirtualFileSystemComponent() },
     *   ];
     * }
     * ```
     */
    static getComponents(): ComponentFactory[] {
        return [];
    }

    /**
     * 获取带ID的组件列表（可选）
     * 子类可重写此方法以自定义组件ID
     *
     * @returns 带ID的组件定义数组
     */
    static getComponentsWithIds(): ComponentDefinition[] {
        const components = this.getComponents();
        return components.map((comp, index) => ({
            id: `component-${index}`,
            component: comp,
        }));
    }

    // ==================== 工具方法 ====================

    /**
     * 从组件列表中获取已实例化的组件
     * 过滤出直接实例（非工厂函数）
     *
     * @returns 已实例化的 ToolComponent 数组
     */
    static getComponentInstances(): ToolComponent[] {
        const components = this.getComponents();
        const instances: ToolComponent[] = [];
        for (const c of components) {
            if (c instanceof ToolComponent) {
                instances.push(c);
            }
        }
        return instances;
    }

    /**
     * 从组件列表中获取工厂函数
     * 过滤出工厂函数（同步或异步）
     *
     * @returns 工厂函数数组
     */
    static getComponentFactories(): Array<() => ToolComponent | Promise<ToolComponent>> {
        const components = this.getComponents();
        const factories: Array<() => ToolComponent | Promise<ToolComponent>> = [];
        for (const c of components) {
            if (typeof c === 'function') {
                factories.push(c as () => ToolComponent | Promise<ToolComponent>);
            }
        }
        return factories;
    }
}
