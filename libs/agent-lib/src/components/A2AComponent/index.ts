/**
 * A2AComponent - Agent Mailbox for agent-to-agent collaboration
 *
 * Provides tools for:
 * - INBOX: receiving, acknowledging, completing, and failing tasks
 * - SENT: delegating tasks, sending queries, tracking results, cancelling
 * - CONTACTS: discovering available agents by capability/skill
 *
 * @module A2AComponent
 */

export { A2ATaskComponent } from './A2ATaskComponent.js';
export { a2aTaskToolSchemas } from './a2aTaskSchemas.js';
export type {
  AcknowledgeTaskParams,
  CompleteTaskParams,
  FailTaskParams,
  SendTaskParams,
  SendQueryParams,
  WaitForResultParams,
  CancelTaskParams,
  DiscoverAgentsParams,
  CheckInboxParams,
  CheckSentParams,
  SentTaskInfo,
  IncomingTaskInfo,
  A2ATaskToolName,
  A2ATaskToolReturnTypes,
  A2ATaskToolReturnType,
} from './a2aTaskSchemas.js';
