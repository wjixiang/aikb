/**
 * Output formatter for agent-cli
 *
 * Provides consistent formatting for different output types.
 */

import chalk from 'chalk';
import * as Table from 'cli-table3';

export type OutputFormat = 'table' | 'json' | 'compact';

/**
 * Format output based on format type
 */
export function formatOutput<T>(
  data: T,
  format: OutputFormat,
  transformer?: (data: T) => any,
): string {
  const transformed = transformer ? transformer(data) : data;

  switch (format) {
    case 'json':
      return JSON.stringify(transformed, null, 2);
    case 'compact':
      return formatCompact(transformed);
    case 'table':
    default:
      if (typeof transformed === 'string') {
        return transformed;
      }
      return formatTable(transformed);
  }
}

/**
 * Format as table
 */
export function formatTable(data: any): string {
  if (Array.isArray(data) && data.length > 0) {
    const first = data[0];
    if (typeof first === 'object' && first !== null) {
      return createObjectTable(data);
    }
  }

  if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
    return createKeyValueTable(data);
  }

  return String(data);
}

/**
 * Create table from array of objects
 */
function createObjectTable(data: any[]): string {
  if (data.length === 0) {
    return chalk.gray('No data');
  }

  const keys = Object.keys(data[0]);
  const table = Table.default({
    head: keys.map((k) => chalk.cyan(k)),
    style: {
      head: [],
      border: ['gray'],
    },
  });

  for (const item of data) {
    const row = keys.map((k) => formatValue(item[k]));
    table.push(row);
  }

  return table.toString();
}

/**
 * Create key-value table from object
 */
function createKeyValueTable(data: Record<string, unknown>): string {
  const table = Table.default({
    style: {
      head: [],
      border: ['gray'],
    },
  });

  for (const [key, value] of Object.entries(data)) {
    table.push([chalk.cyan(key), formatValue(value)]);
  }

  return table.toString();
}

/**
 * Format a single value
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return chalk.gray('N/A');
  }

  if (typeof value === 'boolean') {
    return value ? chalk.green('Yes') : chalk.red('No');
  }

  if (typeof value === 'number') {
    return String(value);
  }

  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.join(', ');
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
}

/**
 * Format as compact output
 */
function formatCompact(data: any): string {
  if (Array.isArray(data)) {
    return data.map((item) => JSON.stringify(item)).join('\n');
  }

  if (typeof data === 'object' && data !== null) {
    return Object.entries(data)
      .map(([k, v]) => `${k}: ${formatValue(v)}`)
      .join('\n');
  }

  return String(data);
}

/**
 * Format agent status with color
 */
export function formatStatus(status: string): string {
  switch (status.toLowerCase()) {
    case 'running':
      return chalk.green('●') + ' ' + status;
    case 'idle':
      return chalk.yellow('○') + ' ' + status;
    case 'stopped':
      return chalk.gray('■') + ' ' + status;
    case 'error':
      return chalk.red('✖') + ' ' + status;
    default:
      return status;
  }
}

/**
 * Format duration in human-readable format
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

/**
 * Format timestamp as relative time
 */
export function formatRelativeTime(timestamp: number | Date): string {
  const now = Date.now();
  const time = typeof timestamp === 'number' ? timestamp : new Date(timestamp).getTime();
  const diff = now - time;

  if (diff < 1000) {
    return 'just now';
  }
  if (diff < 60000) {
    return `${Math.floor(diff / 1000)}s ago`;
  }
  if (diff < 3600000) {
    return `${Math.floor(diff / 60000)}m ago`;
  }
  return formatDuration(diff) + ' ago';
}

/**
 * Create a header box
 */
export function createBox(title: string, content: string): string {
  const lines = content.split('\n');
  const maxLength = Math.max(title.length, ...lines.map((l) => l.length));
  const border = '─'.repeat(maxLength + 2);

  let output = '┌' + border + '┐\n';
  output += '│' + ' '.repeat(Math.max(0, (maxLength - title.length) / 2)) + chalk.bold(title) + ' '.repeat(Math.max(0, maxLength - title.length - Math.floor((maxLength - title.length) / 2))) + '│\n';
  output += '├' + border + '┤\n';

  for (const line of lines) {
    output += '│ ' + line.padEnd(maxLength) + ' │\n';
  }

  output += '└' + border + '┘';

  return output;
}

/**
 * Format statistics
 */
export interface StatItem {
  label: string;
  value: string | number;
  color?: typeof chalk;
}

export function formatStats(items: StatItem[]): string {
  const maxLabelLength = Math.max(...items.map((i) => i.label.length));

  const lines = items.map((item) => {
    const label = item.label.padEnd(maxLabelLength);
    const colorFn = item.color || ((s: string) => s);
    const value = colorFn(String(item.value));
    return `${chalk.cyan(label)} │ ${value}`;
  });

  return lines.join('\n');
}
