/**
 * Agent Lib - Main Entry Point
 *
 * Unified exports from core, components, and multi-agent modules.
 */

// Core module - Agent framework, tools, memory, expert system, etc.
export * from './core/index.js';

// Components module - UI components for bibliograpy search, PICOS, PRISMA, etc.
export * from './components/index.js';

// Multi-Agent module - Explicit re-export from index to avoid conflicts
// Note: InboxResult, MailMessage, SendResult, StorageResult are exported from core
export * from './multi-agent/index.js';
