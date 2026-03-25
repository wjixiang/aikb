import { readFileSync } from 'fs';
import { AgentSoulConfig } from '../../agent/AgentFactory';
import path from 'path';

/**
 * 创建协调者 Agent Soul
 * 协调者负责管理多个子 Agent 完成复杂的文献调查任务
 */
export function createCoordinatorAgentSoul(): AgentSoulConfig {
  return {
    agent: {
      sop: readFileSync(
        path.resolve(import.meta.dirname, 'sop-coordinator.md'),
      ).toString(),
      name: 'Literature Survey Coordinator',
      type: 'coordinator',
      description: '文献调查协调者，负责协调多个专业 Agent 完成系统性文献调查',
    },
    // 协调者不需要额外的组件，它通过工具动态创建组件
    // RuntimeControlComponent 和 A2ATaskComponent 已作为全局组件注册
    components: [],
  };
}

export { createCoordinatorAgentSoul as createAgentSoul };
