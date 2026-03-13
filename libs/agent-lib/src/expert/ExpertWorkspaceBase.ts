/**
 * ExpertWorkspaceBase - Expert Workspace 基类
 *
 * 提供通用的输入/输出处理功能，简化Expert开发
 *
 * 使用方式：
 * ```typescript
 * class MyExpertWorkspace extends ExpertWorkspaceBase {
 *   // 1. 定义组件
 *   static override getComponents() {
 *     return [new MyComponent()];
 *   }
 *
 *   // 2. 定义DI Token映射
 *   static override componentTokenMap = {
 *     'MyComponent': TYPES.MyComponent,
 *   };
 *
 *   // 3. 可选：重写输入验证
 *   static override validateInput(input) {
 *     if (!input.query) {
 *       return { valid: false, errors: ['Missing query'] };
 *     }
 *     return { valid: true };
 *   }
 *
 *   // 4. 可选：重写输出格式化
 *   static override formatOutput(workspace) {
 *     return { custom: 'format' };
 *   }
 * }
 * ```
 */

import { ToolComponent } from '../statefulContext/toolComponent.js';
import { VirtualWorkspace } from '../statefulContext/virtualWorkspace.js';
import type { ExportResult, ExportConfig, InputHandler, ValidationResult } from './types.js';

/**
 * Expert Workspace 基类
 * 
 * 职责：
 * 1. 管理组件导入和注册
 * 2. 输入验证和转换
 * 3. 输出格式化和导出
 */
export abstract class ExpertWorkspaceBase {

    // ==================== 组件管理 ====================

    /**
     * 获取组件列表
     * 子类必须实现此方法
     * 
     * @returns 组件实例数组或DI Token数组
     * 
     * @example
     * ```typescript
     * static override getComponents() {
     *   return [
     *     new MyComponent(),           // 直接实例
     *     TYPES.MyOtherComponent,      // DI Token
     *   ];
     * }
     * ```
     */
    static getComponents(): (ToolComponent | symbol)[] {
        return [];
    }

    /**
     * 组件DI Token映射
     * 用于从config.json的diToken字符串解析为实际的Symbol
     * 
     * @example
     * ```typescript
     * static override componentTokenMap = {
     *   'BibliographySearchComponent': TYPES.BibliographySearchComponent,
     *   'MyComponent': TYPES.MyComponent,
     * };
     * ```
     */
    static componentTokenMap: Record<string, symbol> = {};

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
    static formatOutput(workspace: VirtualWorkspace): Record<string, any> {
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
        workspace: VirtualWorkspace,
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
    protected static getVFSComponent(workspace: VirtualWorkspace): any {
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
     * 从组件列表中获取DI Tokens
     * 用于向DI容器注册组件
     */
    static getComponentTokens(): symbol[] {
        return this.getComponents()
            .filter((c): c is symbol => typeof c === 'symbol');
    }

    /**
     * 从组件列表中获取组件实例
     * 用于直接注册到workspace
     */
    static getComponentInstances(): ToolComponent[] {
        return this.getComponents()
            .filter((c): c is ToolComponent => c instanceof ToolComponent);
    }
}
