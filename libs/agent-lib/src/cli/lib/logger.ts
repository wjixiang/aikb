/**
 * Logger for agent-cli
 *
 * Re-exports from shared logger for global singleton management.
 */

import { getLogger, initLogger } from '@shared/logger';

export { initLogger, getLogger };

/**
 * Log levels - compatibility wrapper
 */
export const log = {
  debug: (msg: string, ...args: unknown[]) => getLogger().debug({ msg, args }),
  info: (msg: string, ...args: unknown[]) => getLogger().info({ msg, args }),
  warn: (msg: string, ...args: unknown[]) => getLogger().warn({ msg, args }),
  error: (msg: string, ...args: unknown[]) => getLogger().error({ msg, args }),
};
