/**
 * Agent 持久化类型定义
 * 
 * Re-exports from persistence-lib for backward compatibility
 */

export {
  type IPersistenceService,
  type InstanceMetadata,
  type PersistenceConfig,
  type Message,
} from 'persistence-lib';

export type { Message as ApiMessage } from 'llm-api-client';
export type { WorkspaceContextEntry } from '../memory/types.js';