/**
 * Pubmed Retrieve Workspace
 *
 * 运行时工作空间 - 用于定义组件
 * 继承 ExpertWorkspaceBase 以获得输入/输出处理能力
 */

import { ExpertWorkspaceBase, ToolComponent, BibliographySearchComponent } from 'agent-lib';
// import { MyComponent } from './components/MyComponent.js';

/**
 * Validation result type for input validation
 */
interface ValidationResult {
  valid: boolean;
  errors?: string[];
  warnings?: string[];
}

/**
 * PubmedRetrieveWorkspace - 运行时工作空间
 *
 * 继承 ExpertWorkspaceBase 以获得静态方法
 * 用于 createExpertConfig 工厂函数
 */
export class PubmedRetrieveWorkspace extends ExpertWorkspaceBase {

  // ==================== 组件定义 ====================

  /**
   * 获取组件列表
   *
   * 支持三种方式定义组件：
   * 1. 直接实例: new MyComponent()
   * 2. 工厂函数: () => new MyComponent()
   * 3. 异步工厂: async () => await createComponent()
   *
   * 示例:
   * // 直接实例
   * static override getComponents() {
   *   return [new MyComponent()];
   * }
   *
   * // 工厂函数
   * static override getComponents() {
   *   return [() => new AnotherComponent()];
   * }
   *
   * // 带自定义ID
   * static override getComponentsWithIds() {
   *   return [{ id: 'my-component', component: new MyComponent() }];
   * }
   */
  static override getComponents(): ToolComponent[] {
    return [
      new BibliographySearchComponent()
    ];
  }

  // ==================== 输入处理 ====================

  /**
   * 验证输入
   */
  static override validateInput(input: Record<string, any>): ValidationResult {
    return { valid: true };
  }

  /**
   * 转换输入格式
   */
  static override transformInput(input: Record<string, any>): Record<string, any> {
    return input;
  }
}
