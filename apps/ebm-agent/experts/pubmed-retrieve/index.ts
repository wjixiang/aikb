/**
 * Pubmed Retrieve - Factory Function
 *
 * 使用 ExpertFactory 自动加载配置，无需样板代码
 *
 * 使用方式：
 *   import { createExpertConfig } from 'agent-lib';
 *   import { PubmedRetrieveWorkspace } from './Workspace.js';
 *   export default createExpertConfig(import.meta.url, PubmedRetrieveWorkspace);
 */

import { createExpertConfig } from 'agent-lib';
import { PubmedRetrieveWorkspace } from './Workspace.js';

const config = createExpertConfig(import.meta.url, PubmedRetrieveWorkspace);
export default config
