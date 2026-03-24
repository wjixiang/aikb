/**
 * A2AComponent - A2A task management components
 *
 * This module provides components for managing A2A (Agent-to-Agent) communication:
 * - A2ATaskComponent: Tools for acknowledging and responding to A2A tasks
 *
 * @module A2AComponent
 */

export { A2ATaskComponent } from './A2ATaskComponent.js';
export { a2aTaskToolSchemas } from './a2aTaskSchemas.js';
export type {
  AcknowledgeTaskParams,
  CompleteTaskParams,
  FailTaskParams,
  SendTaskResultParams,
  GetPendingTasksParams,
  A2ATaskToolName,
  A2ATaskToolReturnTypes,
} from './a2aTaskSchemas.js';
