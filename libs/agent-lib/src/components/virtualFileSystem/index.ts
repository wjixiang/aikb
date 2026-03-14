/**
 * Virtual File System Component
 *
 * Provides file system operations via S3 (rustfs)
 * Tools:
 * - read_file: Read file content
 * - write_file: Write content to file
 * - list_files: List files in directory
 * - delete_file: Delete a file
 * - export_workspace: Export workspace state to file
 */

export { VirtualFileSystemComponent } from './virtualFileSystemComponent.js';
export * from './virtualFileSystemSchemas.js';
