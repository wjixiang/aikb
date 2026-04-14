/**
 * UserContext - DEPRECATED
 *
 * This module is deprecated. A2A and topology modules have been removed.
 * UserContext functionality is no longer available.
 */

export interface IUserContext {
  instanceId: string;
}

export interface UserContextOptions {
  userId?: string;
  defaultTimeout?: number;
}
