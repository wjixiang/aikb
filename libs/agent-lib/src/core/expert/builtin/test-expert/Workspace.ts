/**
 * Test Expert Workspace Module
 *
 * 职责：
 * 1. 导入和注册组件
 */

import { ExpertWorkspaceBase } from '../../ExpertWorkspaceBase.js';

/**
 * TestExpertWorkspace
 *
 * 继承ExpertWorkspaceBase获得通用功能
 * 重写需要自定义的方法
 */
export class TestExpertWorkspace extends ExpertWorkspaceBase {

  // ==================== 组件定义 ====================

  /**
   * 获取组件列表
   *
   * 支持三种方式定义组件：
   * 1. 直接实例: new MyComponent()
   * 2. 工厂函数: () => new MyComponent()
   * 3. 异步工厂: async () => await createComponent()
   */
  static override getComponents() {
    return [
      // 添加组件实例或工厂函数
      // new MyComponent(),
      // () => new AnotherComponent(),
    ];
  }
}
