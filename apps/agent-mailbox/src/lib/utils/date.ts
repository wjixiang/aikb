/**
 * Date formatting utilities
 */

/**
 * Format a date to ISO string
 * @param date - Date to format (Date object or timestamp)
 * @returns ISO formatted string
 */
export function formatISO(date: Date | number | string): string {
  const d = typeof date === 'number' ? new Date(date) : new Date(date);
  return d.toISOString();
}

/**
 * Format a date to a human-readable string
 * @param date - Date to format
 * @returns Formatted date string (e.g., "2026-03-17 14:30:00")
 */
export function formatDateTime(date: Date | number | string): string {
  const d = typeof date === 'number' ? new Date(date) : new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * Format a date to date only string
 * @param date - Date to format
 * @returns Formatted date string (e.g., "2026-03-17")
 */
export function formatDate(date: Date | number | string): string {
  const d = typeof date === 'number' ? new Date(date) : new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get current timestamp in ISO format
 * @returns Current ISO timestamp
 */
export function nowISO(): string {
  return new Date().toISOString();
}

/**
 * Get current timestamp in milliseconds
 * @returns Current timestamp
 */
export function now(): number {
  return Date.now();
}

/**
 * Parse an ISO date string to Date object
 * @param isoString - ISO date string
 * @returns Date object
 */
export function parseISO(isoString: string): Date {
  return new Date(isoString);
}

/**
 * Check if a date is valid
 * @param date - Date to check
 * @returns True if valid
 */
export function isValidDate(date: unknown): date is Date {
  return date instanceof Date && !isNaN(date.getTime());
}

/**
 * Add milliseconds to a date
 * @param date - Base date
 * @param ms - Milliseconds to add
 * @returns New date
 */
export function addMilliseconds(date: Date, ms: number): Date {
  return new Date(date.getTime() + ms);
}

/**
 * Add seconds to a date
 * @param date - Base date
 * @param seconds - Seconds to add
 * @returns New date
 */
export function addSeconds(date: Date, seconds: number): Date {
  return addMilliseconds(date, seconds * 1000);
}

/**
 * Add minutes to a date
 * @param date - Base date
 * @param minutes - Minutes to add
 * @returns New date
 */
export function addMinutes(date: Date, minutes: number): Date {
  return addMilliseconds(date, minutes * 60 * 1000);
}

/**
 * Add hours to a date
 * @param date - Base date
 * @param hours - Hours to add
 * @returns New date
 */
export function addHours(date: Date, hours: number): Date {
  return addMilliseconds(date, hours * 60 * 60 * 1000);
}

/**
 * Add days to a date
 * @param date - Base date
 * @param days - Days to add
 * @returns New date
 */
export function addDays(date: Date, days: number): Date {
  return addMilliseconds(date, days * 24 * 60 * 60 * 1000);
}

/**
 * Get the difference between two dates in milliseconds
 * @param dateA - First date
 * @param dateB - Second date (defaults to now)
 * @returns Difference in milliseconds
 */
export function differenceInMilliseconds(dateA: Date, dateB: Date = new Date()): number {
  return dateA.getTime() - dateB.getTime();
}

/**
 * Get the difference between two dates in seconds
 * @param dateA - First date
 * @param dateB - Second date (defaults to now)
 * @returns Difference in seconds
 */
export function differenceInSeconds(dateA: Date, dateB: Date = new Date()): number {
  return Math.floor(differenceInMilliseconds(dateA, dateB) / 1000);
}

/**
 * Get the difference between two dates in minutes
 * @param dateA - First date
 * @param dateB - Second date (defaults to now)
 * @returns Difference in minutes
 */
export function differenceInMinutes(dateA: Date, dateB: Date = new Date()): number {
  return Math.floor(differenceInMilliseconds(dateA, dateB) / (1000 * 60));
}
