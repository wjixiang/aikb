/**
 * My Test Expert Workspace Module
 *
 * 职责：
 * 1. 导入和注册组件
 * 2. 输入验证和转换
 * 3. 输出格式化和导出
 */

import { ExpertWorkspaceBase } from 'agent-lib';
import type { ValidationResult } from 'agent-lib';

/**
 * MyTestExpertWorkspace
 * 
 * 继承ExpertWorkspaceBase获得通用功能
 * 重写需要自定义的方法
 */
export class MyTestExpertWorkspace extends ExpertWorkspaceBase {
  
  // ==================== 组件定义 ====================
  
  /**
   * 获取组件列表
   * 返回组件实例或DI Token
   */
  static override getComponents() {
    return [
      // 添加组件实例或DI Token
      // new MyComponent(),
      // TYPES.MyOtherComponent,
    ];
  }
  
  /**
   * 组件DI Token映射
   * 用于从config.json的diToken字符串解析为实际的Symbol
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
    
    // 注意：使用 exactOptionalPropertyTypes 时，不要显式设置 undefined
    // 而是使用条件展开来省略空数组
    return {
      valid: errors.length === 0,
      ...(errors.length > 0 && { errors }),
    };
  }
  
  /**
   * 转换输入格式
   * 重写以实现输入转换（如添加默认值、格式转换等）
   */
  static override transformInput(input: Record<string, any>): Record<string, any> {
    return {
      ...input,
      timestamp: Date.now(),
    };
  }
  
  // ==================== 输出处理 ====================
  
  /**
   * 格式化输出
   * 重写以实现自定义输出格式
   */
  static override formatOutput(workspace: any): Record<string, any> {
    return super.formatOutput(workspace);
  }
}
