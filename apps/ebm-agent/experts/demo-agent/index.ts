/**
 * Demo Agent - Factory Function
 *
 * 使用 ExpertFactory 自动加载配置，无需样板代码
 *
 * 使用方式：
 *   import { createExpertConfig } from 'agent-lib';
 *   import { DemoAgentWorkspace } from './Workspace.js';
 *   export default createExpertConfig(import.meta.url, DemoAgentWorkspace);
 */

import { createExpertConfig } from 'agent-lib';
import { DemoAgentWorkspace } from './Workspace.js';

export default createExpertConfig(import.meta.url, DemoAgentWorkspace);
