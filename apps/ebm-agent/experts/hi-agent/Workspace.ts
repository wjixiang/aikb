/**
 * Hi Agent Workspace
 *
 * 运行时工作空间 - 用于定义组件
 * 继承 ExpertWorkspaceBase 以获得输入/输出处理能力
 */

import { ExpertWorkspaceBase } from 'agent-lib';
import type { ValidationResult } from 'agent-lib';
import { HelloComponent } from './components/HelloComponent.js';

/**
 * HiAgentWorkspace - 运行时工作空间
 *
 * 继承 ExpertWorkspaceBase 以获得静态方法
 * 用于 createExpertConfig 工厂函数
 */
export class HiAgentWorkspace extends ExpertWorkspaceBase {

  // ==================== 组件定义 ====================

  /**
   * 获取组件列表
   */
  static override getComponents() {
    return [
      new HelloComponent(),
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
