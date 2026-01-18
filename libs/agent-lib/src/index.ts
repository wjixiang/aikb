// Export from existing agent-lib modules
import { AgentV2, AgentConfig, defaultAgentConfig, defaultApiConfig } from './agent/v2/agentV2';
import { NativeToolCallParser } from './assistant-message/NativeToolCallParser';
import { Task } from './task/task.entity';
import { TaskService } from './task/task.service';

export * from './agent-lib.module';
export { NativeToolCallParser };
export { Task, TaskService };



// Export from merged llm-api (includes reasoning functions)
export * from './api';

// Export from merged llm-shared (excluding duplicates from api)
export * from './shared/array';
export * from './shared/browserUtils';
export * from './shared/combineApiRequests';
export * from './shared/combineCommandSequences';
export * from './shared/context-mentions';
export * from './shared/cost';
export * from './shared/embeddingModels';
export * from './shared/getApiMetrics';
export * from './shared/globalFileNames';
export * from './shared/language';
export * from './shared/mcp';
export * from './shared/requesty';
export * from './shared/safeJsonParse';
export * from './shared/support-prompt';
export * from './shared/todo';
export * from './shared/tools';

// Export from merged llm-tools
export * from './tools';

// Export from merged llm-types
export * from './types';
export type { ApiMessage } from './task/task.type'

// Export from agent v2 (virtual workspace)
export * from './agent/v2/virtualWorkspace';
export * from './agent/v2/statefulComponent';
export { AgentV2, defaultAgentConfig, defaultApiConfig }
export type { AgentConfig }