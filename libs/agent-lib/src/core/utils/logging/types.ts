/**
 * @fileoverview Core type definitions for the compact logging system
 */

import pino from "pino";

/**
 * Represents a compact log entry format optimized for storage and transmission
 */
export interface CompactLogEntry {
  /** Delta timestamp from last entry in milliseconds */
  t: number;
  /** Log level identifier */
  l: string;
  /** Log message content */
  m: string;
  /** Optional context identifier */
  c?: string;
  /** Optional structured data payload */
  d?: unknown;
}

/** Available log levels in ascending order of severity */
export const LOG_LEVELS = ['debug', 'info', 'warn', 'error', 'fatal'] as const;
/** Type representing valid log levels */
export type LogLevel = (typeof LOG_LEVELS)[number];

/**
 * Metadata structure for log entries
 */
export interface LogMeta {
  /** Optional context identifier */
  ctx?: string;
  /** Additional arbitrary metadata fields */
  [key: string]: unknown;
}

/**
 * Configuration options for CompactTransport
 */
export interface CompactTransportConfig {
  /** Minimum log level to process */
  level?: LogLevel;
  /** File output configuration */
  fileOutput?: {
    /** Whether file output is enabled */
    enabled: boolean;
    /** Path to the log file */
    path: string;
  };
}

/**
 * Interface for log transport implementations
 */
export interface ICompactTransport {
  /**
   * Writes a log entry to the transport
   * @param entry - The log entry to write
   */
  write(entry: CompactLogEntry): void;

  /**
   * Closes the transport and performs cleanup
   */
  close(): void;
}

/**
 * Interface for logger implementations
 */
export type ILogger = pino.Logger
