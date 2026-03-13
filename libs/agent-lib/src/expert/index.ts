/**
 * Expert Module - Multi-Expert Architecture
 *
 * Replaces the original Skill architecture:
 * - Expert = Original Skill + Independent Agent Instance + Independent Context
 * - Each Expert has its own VirtualWorkspace, MemoryModule, Tools
 * - Controller Agent is responsible for scheduling and result aggregation
 */

// Types
export * from './types.js';

// Classes
export { ExpertRegistry } from './ExpertRegistry.js';
export { ExpertExecutor } from './ExpertExecutor.js';
export { ExpertOrchestrator } from './ExpertOrchestrator.js';
export { ExpertInstance } from './ExpertInstance.js';

// CLI
export * from './cli/index.js';

// Builtin Experts
export * from './builtin/index.js';
