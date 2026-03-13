/**
 * My Expert Workspace Module
 * 
 * 职责：
 * 1. 导入和注册组件
 * 2. 输入验证和转换
 * 3. 输出格式化和导出
 */

import { ExpertWorkspaceBase } from '../../ExpertWorkspaceBase.js';
import type { ValidationResult } from '../../types.js';

/**
 * MyExpertWorkspace
 * 
 * 继承ExpertWorkspaceBase获得通用功能
 * 重写需要自定义的方法
 */
export class MyExpertWorkspace extends ExpertWorkspaceBase {

    // ==================== 组件定义 ====================

    /**
     * 获取组件列表
     * 返回组件实例或DI Token
     * 
     * 示例：
     * ```typescript
     * static override getComponents() {
     *   return [
     *     new MyComponent(),           // 直接实例
     *     TYPES.MyOtherComponent,      // DI Token
     *   ];
     * }
     * ```
     */
    static override getComponents() {
        return [
            // 添加组件实例或DI Token
        ];
    }

    /**
     * 组件DI Token映射
     * 用于从config.json的diToken字符串解析为实际的Symbol
     * 
     * 示例：
     * ```typescript
     * static override componentTokenMap = {
     *   'BibliographySearchComponent': TYPES.BibliographySearchComponent,
     *   'MyComponent': TYPES.MyComponent,
     * };
     * ```
     */
    static override componentTokenMap: Record<string, symbol> = {
        // 'MyComponent': TYPES.MyComponent,
    };

    // ==================== 输入处理 ====================

    /**
     * 验证输入
     * 重写以实现自定义验证逻辑
     */
    static override validateInput(input: Record<string, any>): ValidationResult {
        const errors: string[] = [];

        // 示例验证：检查必需字段
        if (!input['query'] && !input['input']) {
            errors.push('Missing required field: query or input');
        }

        return {
            valid: errors.length === 0,
            errors: errors.length > 0 ? errors : undefined,
        };
    }

    /**
     * 转换输入格式
     * 重写以实现输入转换（如添加默认值、格式转换等）
     */
    static override transformInput(input: Record<string, any>): Record<string, any> {
        return {
            ...input,
            // 添加默认值或转换格式
            timestamp: Date.now(),
        };
    }

    /**
     * 加载外部数据
     * 重写以实现从外部存储（如S3）加载数据
     */
    static override async loadExternalData(input: Record<string, any>): Promise<Record<string, any>> {
        // 如果有S3 key，加载数据
        // if (input.s3Key) {
        //   const vfs = ...;
        //   const data = await vfs.readFile(input.s3Key);
        //   return { ...input, loadedData: data };
        // }

        return input;
    }

    // ==================== 输出处理 ====================

    /**
     * 格式化输出
     * 重写以实现自定义输出格式
     */
    static override formatOutput(workspace: any): Record<string, any> {
        // 使用基类的默认实现，或自定义格式化逻辑
        return super.formatOutput(workspace);
    }

    /**
     * 导出处理
     * 重写以实现自定义导出格式（如CSV、XML等）
     */
    static override async exportHandler(
        workspace: any,
        config: any
    ): Promise<any> {
        // 使用基类的默认JSON导出，或自定义导出逻辑
        return super.exportHandler(workspace, config);
    }
}
