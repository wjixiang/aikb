/**
 * My Expert Workspace
 *
 * 运行时工作空间 - 用于定义组件
 */

import { ExpertWorkspaceBase, type ComponentDefinition } from '../../ExpertWorkspaceBase.js';

/**
 * MyExpertWorkspace - 运行时工作空间
 *
 * 继承 ExpertWorkspaceBase 以获得静态方法
 * 用于 createExpertConfig 工厂函数
 */
export class MyExpertWorkspace extends ExpertWorkspaceBase {

  // ==================== 组件定义 ====================

  /**
   * 获取组件列表
   *
   * 支持三种方式定义组件：
   * 1. 直接实例: new MyComponent()
   * 2. 工厂函数: () => new MyComponent()
   * 3. 异步工厂: async () => await createComponent()
   *
   * @example
   * ```typescript
   * static override getComponents() {
   *   return [
   *     new MyComponent(),                    // 直接实例
   *     () => new VirtualFileSystemComponent(), // 工厂函数
   *   ];
   * }
   * ```
   *
   * @example
   * ```typescript
   * // 自定义组件ID
   * static override getComponentsWithIds() {
   *   return [
   *     { id: 'search', component: new BibliographySearchComponent() },
   *     { id: 'vfs', component: () => new VirtualFileSystemComponent() },
   *   ];
   * }
   * ```
   */
  static override getComponents() {
    return [
      // 添加组件实例或工厂函数
      // new MyComponent(),
      // () => new AnotherComponent(),
    ];
  }
}
