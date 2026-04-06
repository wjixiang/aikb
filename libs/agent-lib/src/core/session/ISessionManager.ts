/**
 * Session Manager Interface
 *
 * Stateless interface for session lifecycle management.
 * Manages Session-level data (status, token usage, etc.)
 * Instance-level data (component states, memory) is managed separately.
 */

import type { SessionState } from './types.js';

export interface ISessionManager {
  /**
   * Create a new persistence session
   */
  createSession(state: SessionState): Promise<void>;

  /**
   * Persist current agent state
   */
  persistState(state: SessionState): Promise<void>;

  /**
   * End the current session
   * Updates both Session and Instance status to 'sleeping' or 'aborted'
   */
  endSession(state: SessionState, reason?: string): Promise<void>;

  /**
   * Restore session state from persistence.
   * Returns the saved SessionState or null if no session exists.
   */
  restoreSession(): Promise<SessionState | null>;
}
