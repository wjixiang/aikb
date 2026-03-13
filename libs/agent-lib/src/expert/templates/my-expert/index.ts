/**
 * My Expert - Factory Function
 *
 * 使用ExpertFactory自动加载配置，无需样板代码
 */

import { createExpertConfig } from '../../ExpertFactory.js';
import { MyExpertWorkspaceStatic } from './Workspace.js';

/**
 * 创建Expert配置
 *
 * 工厂函数会自动：
 * 1. 加载config.json
 * 2. 加载sop.yaml
 * 3. 构建prompt（capability + direction）
 * 4. 从Static命名空间获取输入/输出处理器
 */
export default createExpertConfig(import.meta.url, MyExpertWorkspaceStatic);
