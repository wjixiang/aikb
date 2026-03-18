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

import { ToolComponent } from '../../components/index.js';
import { VirtualWorkspace } from '../statefulContext/virtualWorkspace.js';
import type { IVirtualWorkspace } from '../../components/index.js';
import type { ExportResult, ExportConfig, InputHandler, ValidationResult } from './types.js';

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

    // ==================== 输入处理 ====================

    /**
     * 验证输入
     * 子类可重写以实现自定义验证逻辑
     *
     * @param input - 用户输入
     * @returns 验证结果
     */
    static validateInput(input: Record<string, any>): ValidationResult {
        return { valid: true };
    }

    /**
     * 转换输入格式
     * 子类可重写以实现输入转换（如添加默认值、格式转换等）
     * 
     * @param input - 原始输入
     * @returns 转换后的输入
     */
    static transformInput(input: Record<string, any>): Record<string, any> {
        return input;
    }

    /**
     * 加载外部数据
     * 子类可重写以实现从外部存储（如S3）加载数据
     * 
     * @param input - 输入（可能包含外部数据引用）
     * @returns 加载外部数据后的输入
     */
    static async loadExternalData(input: Record<string, any>): Promise<Record<string, any>> {
        return input;
    }

    /**
     * 获取完整的InputHandler
     * 用于ExpertConfig.input
     */
    static getInputHandler(): InputHandler {
        return {
            validate: (input) => this.validateInput(input),
            transform: (input) => this.transformInput(input),
            loadExternalData: (input) => this.loadExternalData(input),
        };
    }

    // ==================== 输出处理 ====================

    /**
     * 格式化输出
     * 从workspace中提取所有组件状态
     *
     * @param workspace - 虚拟工作空间
     * @returns 格式化的输出对象
     */
    static formatOutput(workspace: IVirtualWorkspace): Record<string, any> {
        const outputs: Record<string, any> = {};
        const componentKeys = workspace.getComponentKeys();

        for (const key of componentKeys) {
            const component = workspace.getComponent(key);
            if (component) {
                outputs[key] = component.getState();
            }
        }

        return outputs;
    }

    /**
     * 导出处理
     * 默认实现：将输出格式化为JSON并导出
     * 子类可重写以实现自定义导出格式（如CSV、XML等）
     *
     * @param workspace - 虚拟工作空间
     * @param config - 导出配置
     * @returns 导出结果
     */
    static async exportHandler(
        workspace: IVirtualWorkspace,
        config: ExportConfig
    ): Promise<ExportResult> {
        try {
            const output = this.formatOutput(workspace);
            const content = JSON.stringify(output, null, 2);

            // 获取VirtualFileSystemComponent进行导出
            const vfsComponent = this.getVFSComponent(workspace);
            if (!vfsComponent) {
                return {
                    success: false,
                    error: 'VirtualFileSystemComponent not found in workspace'
                };
            }

            return await vfsComponent.exportContent(
                config.bucket,
                config.path,
                content,
                'application/json'
            );
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }

    /**
     * 获取VirtualFileSystemComponent
     * 用于文件导出
     */
    protected static getVFSComponent(workspace: IVirtualWorkspace): any {
        const componentKeys = workspace.getComponentKeys();

        for (const key of componentKeys) {
            const component = workspace.getComponent(key);
            if (component) {
                const className = component.constructor?.name;
                if (className === 'VirtualFileSystemComponent' ||
                    key.includes('virtualFileSystem') ||
                    key === 'virtualFileSystem') {
                    return component;
                }
            }
        }

        return null;
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
