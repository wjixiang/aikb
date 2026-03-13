/**
 * My Expert Workspace Module
 *
 * 职责：
 * 1. 导入和注册组件
 * 2. 输入验证和转换
 * 3. 输出格式化和导出
 *
 * 使用方式：
 * - 继承 VirtualWorkspace 创建运行时工作空间
 * - 使用 VirtualWorkspaceStatic 定义静态配置
 */

import { VirtualWorkspace, VirtualWorkspaceStatic } from '../../index.js';
import type { ValidationResult } from '../../index.js';

/**
 * MyExpertWorkspace - 运行时工作空间
 *
 * 继承VirtualWorkspace以获得完整的运行时能力
 * 在构造函数中注册组件
 */
export class MyExpertWorkspace extends VirtualWorkspace {
  constructor() {
    super({ id: 'my-expert', name: 'My Expert' });

    // 方式1：直接在构造函数中注册组件
    // import { MyComponent } from './components/MyComponent.js';
    // this.registerComponent('myComponent', new MyComponent());

    // 方式2：注册多个组件
    // this.registerComponents([
    //   { id: 'componentA', component: new ComponentA() },
    //   { id: 'componentB', component: new ComponentB(), priority: 10 },
    // ]);
  }
}

/**
 * MyExpertWorkspaceStatic - 静态配置
 *
 * 使用VirtualWorkspaceStatic命名空间定义静态配置
 * 用于ExpertFactory加载配置和输入/输出处理
 */
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace MyExpertWorkspaceStatic {
  // ==================== 组件定义 ====================

  /**
   * 获取组件列表
   * 返回组件实例或DI Token
   *
   * 示例：
   * ```typescript
   * export function getComponents() {
   *   return [
   *     new MyComponent(),           // 直接实例
   *     TYPES.MyOtherComponent,      // DI Token
   *   ];
   * }
   * ```
   */
  export function getComponents() {
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
   * export const componentTokenMap = {
   *   'BibliographySearchComponent': TYPES.BibliographySearchComponent,
   *   'MyComponent': TYPES.MyComponent,
   * };
   * ```
   */
  export const componentTokenMap: Record<string, symbol> = {
    // 'MyComponent': TYPES.MyComponent,
  };

  // ==================== 输入处理 ====================

  /**
   * 验证输入
   * 重写以实现自定义验证逻辑
   */
  export function validateInput(input: Record<string, any>): ValidationResult {
    const errors: string[] = [];

    // 示例验证：检查必需字段
    if (!input['query'] && !input['input']) {
      errors.push('Missing required field: query or input');
    }

    return {
      valid: errors.length === 0,
      ...(errors.length > 0 && { errors }),
    };
  }

  /**
   * 转换输入格式
   * 重写以实现输入转换（如添加默认值、格式转换等）
   */
  export function transformInput(input: Record<string, any>): Record<string, any> {
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
  export async function loadExternalData(input: Record<string, any>): Promise<Record<string, any>> {
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
   * 使用默认实现，或重写以实现自定义输出格式
   */
  export function formatOutput(workspace: any): Record<string, any> {
    return VirtualWorkspaceStatic.formatOutput(workspace);
  }

  /**
   * 导出处理
   * 使用默认实现，或重写以实现自定义导出格式（如CSV、XML等）
   */
  export async function exportHandler(workspace: any, config: any): Promise<any> {
    return VirtualWorkspaceStatic.exportHandler(workspace, config);
  }
}
