// Export from existing agent-lib modules
import { Agent, AgentConfig, defaultAgentConfig } from './agent/agent.js';
import { NativeToolCallParser } from './assistant-message/NativeToolCallParser.js';

// Export from merged agent-db
import { prisma, AgentDBPrismaService } from './prisma.js';
import { AgentDBModule as AgentDBModuleExport } from './agent-db.module.js';

export * from './agent-lib.module.js';
export { NativeToolCallParser };
export { prisma, AgentDBPrismaService, AgentDBModuleExport as AgentDBModule };



// Export from merged llm-api (includes reasoning functions)
// export * from './api';




// Export from merged llm-types
export * from './types/index.js';
export type { ApiMessage } from './task/task.type.js'
export { MessageBuilder } from './task/task.type.js'
export { MessageContentFormatter } from './task/MessageFormatter.util.js'

// Export from agent v2 (virtual workspace) - re-exported from statefulContext
// export * from './agent/virtualWorkspace';
// export * from './agent/statefulComponent';
// export { Agent, defaultAgentConfig }
export type { AgentConfig }

// Export API client and factory
export * from './api-client/index.js';
export { AgentFactory } from './agent/AgentFactory.js';
export type { AgentFactoryOptions } from './agent/AgentFactory.js';

// Export ObservableAgent (Proxy-based observer pattern)
export * from './agent/ObservableAgent.js';

// Re-export from statefulContext (now integrated into agent-lib)
export * from './statefulContext/index.js';

// Re-export from skills (now integrated into agent-lib)
export * from './skills/index.js';

// Export DI (Dependency Injection) module
export * from './di/index.js';