export interface ConversionResult {
  success: boolean;
  data?: any;
  error?: string;
  downloadedFiles?: string[];
  taskId?: string;
  uploadedImages?: ImageUploadResult[];
}

export interface ImageUploadResult {
  originalPath: string; // Original path in ZIP file
  s3Url: string; // S3 URL after upload
  fileName: string; // S3 key/filename
  success?: boolean; // Whether the upload was successful
  error?: string; // Error message if upload failed
}

/**
 * Interface for PDF converters
 * Defines the contract that all PDF converter implementations must follow
 */
export interface IPdfConvertor {
  /**
   * Convert a PDF file to markdown from a local file path
   * @param pdfPath Path to the PDF file
   * @param options Optional conversion parameters
   * @returns Promise<ConversionResult> The conversion result
   */
  convertPdfToMarkdown(
    pdfPath: string,
    options?: any,
  ): Promise<ConversionResult>;

  /**
   * Convert a PDF file to markdown from an S3 URL
   * @param s3Url The S3 download URL of the PDF
   * @param options Optional conversion parameters
   * @returns Promise<ConversionResult> The conversion result
   */
  convertPdfToMarkdownFromS3(
    s3Url: string,
    options?: any,
  ): Promise<ConversionResult>;

  /**
   * Process a local PDF file using batch upload
   * @param filePath Path to the local PDF file
   * @param options Optional processing parameters
   * @returns Promise<ConversionResult> The conversion result
   */
  processLocalFile?(filePath: string, options?: any): Promise<ConversionResult>;

  /**
   * Process multiple local files
   * @param filePaths Array of file paths
   * @param options Optional processing parameters
   * @returns Promise<ConversionResult[]> Array of conversion results
   */
  processMultipleFiles?(
    filePaths: string[],
    options?: any,
  ): Promise<ConversionResult[]>;

  /**
   * Process URLs in batch
   * @param urls Array of URLs to process
   * @param options Optional processing parameters
   * @returns Promise<ConversionResult[]> Array of conversion results
   */
  processUrls?(urls: string[], options?: any): Promise<ConversionResult[]>;

  /**
   * Cancel a running task
   * @param taskId The ID of the task to cancel
   * @returns Promise<boolean> True if cancellation was successful
   */
  cancelTask?(taskId: string): Promise<boolean>;

  /**
   * Get the status of a task
   * @param taskId The ID of the task to check
   * @returns Promise<any> The task result
   */
  getTaskStatus?(taskId: string): Promise<any>;

  /**
   * Validate the API token (if applicable)
   * @returns Promise<boolean> True if token is valid
   */
  validateToken?(): Promise<boolean>;

  /**
   * Clean up downloaded files
   * @param olderThanHours Age in hours for files to be considered old
   */
  cleanupDownloadedFiles?(olderThanHours?: number): Promise<void>;

  /**
   * Get the current download directory
   * @returns The current download directory path
   */
  getDownloadDirectory?(): string;

  /**
   * Set the download directory
   * @param directory The new download directory
   */
  setDownloadDirectory?(directory: string): void;
}
