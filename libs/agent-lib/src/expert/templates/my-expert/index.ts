/**
 * Test Expert - Factory Function
 *
 * 使用 ExpertFactory 自动加载配置，无需样板代码
 *
 * 方式1（推荐）：最简方式，无需额外配置
 *   import { createSimpleExpertConfig } from 'agent-lib';
 *   export default createSimpleExpertConfig(import.meta.url);
 *
 * 方式2：需要自定义输入/输出处理时
 *   import { createExpertConfig } from 'agent-lib';
 *   import { MyExpertWorkspaceStatic } from './Workspace.js';
 *   export default createExpertConfig(import.meta.url, MyExpertWorkspaceStatic);
 */

import { createSimpleExpertConfig } from 'agent-lib';

export default createSimpleExpertConfig(import.meta.url);
