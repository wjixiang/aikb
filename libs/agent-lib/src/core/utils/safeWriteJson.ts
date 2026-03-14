import * as fs from 'node:fs/promises';
import * as path from 'path';
import { tmpdir } from 'node:os';

/**
 * Safely writes JSON data to a file using atomic write pattern
 * This prevents partial writes and corruption
 */
export async function safeWriteJson(
  filePath: string,
  data: unknown,
): Promise<void> {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });

  const tempFile = path.join(
    tmpdir(),
    `safe-write-${Date.now()}-${Math.random().toString(36).slice(2)}.json`,
  );

  try {
    await fs.writeFile(tempFile, JSON.stringify(data, null, 2), 'utf-8');
    await fs.rename(tempFile, filePath);
  } catch (error) {
    // Clean up temp file if something went wrong
    try {
      await fs.unlink(tempFile);
    } catch {
      // Ignore cleanup errors
    }
    throw error;
  }
}
