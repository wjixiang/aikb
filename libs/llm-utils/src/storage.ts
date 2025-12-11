import * as path from 'path';
import * as fs from 'fs/promises';
import { constants as fsConstants } from 'fs';

/**
 * Gets the base storage path for conversations
 * If a custom path is configured via environment variable, uses that path
 * Otherwise uses the default path provided
 */
export async function getStorageBasePath(defaultPath: string): Promise<string> {
  // Get custom storage path from environment variable
  const customStoragePath = process.env['LLM_CUSTOM_STORAGE_PATH'] || '';

  // If no custom path is set, use default path
  if (!customStoragePath) {
    return defaultPath;
  }

  try {
    // Ensure custom path exists
    await fs.mkdir(customStoragePath, { recursive: true });

    // Check directory write permission without creating temp files
    await fs.access(
      customStoragePath,
      fsConstants.R_OK | fsConstants.W_OK | fsConstants.X_OK,
    );

    return customStoragePath;
  } catch (error) {
    // If path is unusable, report error and fall back to default path
    console.error(
      `Custom storage path is unusable: ${error instanceof Error ? error.message : String(error)}`,
    );
    return defaultPath;
  }
}

/**
 * Gets the storage directory path for a task
 */
export async function getTaskDirectoryPath(
  globalStoragePath: string,
  taskId: string,
): Promise<string> {
  const basePath = await getStorageBasePath(globalStoragePath);
  const taskDir = path.join(basePath, 'tasks', taskId);
  await fs.mkdir(taskDir, { recursive: true });
  return taskDir;
}

/**
 * Gets the settings directory path
 */
export async function getSettingsDirectoryPath(
  globalStoragePath: string,
): Promise<string> {
  const basePath = await getStorageBasePath(globalStoragePath);
  const settingsDir = path.join(basePath, 'settings');
  await fs.mkdir(settingsDir, { recursive: true });
  return settingsDir;
}

/**
 * Gets the cache directory path
 */
export async function getCacheDirectoryPath(
  globalStoragePath: string,
): Promise<string> {
  const basePath = await getStorageBasePath(globalStoragePath);
  const cacheDir = path.join(basePath, 'cache');
  await fs.mkdir(cacheDir, { recursive: true });
  return cacheDir;
}

/**
 * Validates a storage path to ensure it's usable
 * @param inputPath The path to validate
 * @returns Error message if invalid, null if valid
 */
export function validateStoragePath(inputPath: string): string | null {
  if (!inputPath) {
    return null; // Allow empty value (use default path)
  }

  try {
    // Validate path format
    path.parse(inputPath);

    // Check if path is absolute
    if (!path.isAbsolute(inputPath)) {
      return 'Please enter an absolute path';
    }

    return null; // Path format is valid
  } catch (e) {
    return 'Please enter a valid path';
  }
}

/**
 * Sets a custom storage path via environment variable
 * Note: This function only validates the path format. The actual environment
 * variable must be set by the calling process.
 * @param newPath The new storage path to set
 * @returns Promise that resolves to true if the path is valid and accessible
 */
export async function setCustomStoragePath(newPath: string): Promise<boolean> {
  // Validate path format
  const validationError = validateStoragePath(newPath);
  if (validationError) {
    console.error(validationError);
    return false;
  }

  if (!newPath) {
    console.log('Using default storage path');
    return true;
  }

  try {
    // Test if path is accessible
    await fs.mkdir(newPath, { recursive: true });
    await fs.access(
      newPath,
      fsConstants.R_OK | fsConstants.W_OK | fsConstants.X_OK,
    );
    console.log(`Custom storage path is accessible: ${newPath}`);
    return true;
  } catch (error) {
    console.error(
      `Cannot access path: ${newPath}. Error: ${error instanceof Error ? error.message : String(error)}`,
    );
    return false;
  }
}
