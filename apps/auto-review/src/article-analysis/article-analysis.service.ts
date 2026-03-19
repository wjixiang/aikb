import { Injectable, Logger } from '@nestjs/common';
import { MinerUClient, AgentUrlParseRequest } from 'mineru-client';
import * as fs from 'fs';
import * as path from 'path';

export interface PdfExtractOptions {
  url?: string;
  filePath?: string;
  language?: 'en' | 'ch';
  isOcr?: boolean;
  enableFormula?: boolean;
  enableTable?: boolean;
  pageRanges?: string;
  useAgentApi?: boolean;
  pollInterval?: number;
  timeout?: number;
  downloadDir?: string;
}

export interface PdfExtractResult {
  markdown: string;
  images: string[];
  taskId: string;
  downloadedFiles: string[];
}

@Injectable()
export class ArticleAnalysisService {
  private readonly logger = new Logger(ArticleAnalysisService.name);
  private client: MinerUClient;
  private downloadDir: string;

  constructor() {
    // Initialize MinerU client
    const token = process.env.MINERU_TOKEN;
    this.downloadDir = process.env.MINERU_DOWNLOAD_DIR || './mineru-downloads';

    this.client = new MinerUClient({
      token,
      downloadDir: this.downloadDir,
      defaultOptions: {
        is_ocr: false,
        enable_formula: true,
        enable_table: true,
        language: 'ch',
        model_version: 'vlm',
      },
    });

    this.logger.log(`MinerUClient initialized, download dir: ${this.downloadDir}`);
  }

  /**
   * Extract content from PDF URL using MinerU API
   */
  async extractFromUrl(options: PdfExtractOptions): Promise<PdfExtractResult> {
    const {
      url,
      language = 'ch',
      isOcr = false,
      enableFormula = true,
      enableTable = true,
      pageRanges,
      useAgentApi = false,
      pollInterval = 5000,
      timeout = 300000,
    } = options;

    if (!url) {
      throw new Error('URL is required for PDF extraction');
    }

    this.logger.log(`Extracting PDF from URL: ${url}`);
    this.logger.log(`Using Agent API: ${useAgentApi}`);

    // Ensure download directory exists
    if (!fs.existsSync(this.downloadDir)) {
      fs.mkdirSync(this.downloadDir, { recursive: true });
    }

    if (useAgentApi) {
      // Use Agent Lightweight API (no auth required)
      return this.extractUsingAgentApi(url, language, pollInterval, timeout);
    } else {
      // Use Precision API (requires token)
      return this.extractUsingPrecisionApi(
        url,
        language,
        isOcr,
        enableFormula,
        enableTable,
        pageRanges,
        pollInterval,
        timeout,
      );
    }
  }

  /**
   * Extract using Precision API (with token)
   */
  private async extractUsingPrecisionApi(
    url: string,
    language: 'en' | 'ch',
    isOcr: boolean,
    enableFormula: boolean,
    enableTable: boolean,
    pageRanges: string | undefined,
    pollInterval: number,
    timeout: number,
  ): Promise<PdfExtractResult> {
    if (!this.client.config.token) {
      throw new Error('MINERU_TOKEN is required for Precision API');
    }

    const request = {
      url,
      language,
      is_ocr: isOcr,
      enable_formula: enableFormula,
      enable_table: enableTable,
      page_ranges: pageRanges,
      model_version: 'vlm' as const,
    };

    this.logger.log('Creating Precision API task...');
    const { result, downloadedFiles } = await this.client.processSingleFile(request, {
      pollInterval,
      timeout,
      downloadDir: this.downloadDir,
    });

    // Extract markdown from downloaded zip
    const { ZipProcessor } = await import('mineru-client');
    const zipProcessor = new ZipProcessor();
    let markdown = '';
    let images: string[] = [];

    if (downloadedFiles && downloadedFiles.length > 0) {
      const zipPath = downloadedFiles[0];
      const zipBuffer = await fs.promises.readFile(zipPath);
      markdown = (await zipProcessor.extractMarkdownFromZip(zipBuffer)) || '';
      this.logger.log(`Extracted ${markdown.length} chars of markdown`);
    }

    return {
      markdown,
      images,
      taskId: result.task_id || 'unknown',
      downloadedFiles: downloadedFiles || [],
    };
  }

  /**
   * Extract using Agent Lightweight API (no auth)
   */
  private async extractUsingAgentApi(
    url: string,
    language: string,
    pollInterval: number,
    timeout: number,
  ): Promise<PdfExtractResult> {
    const request: AgentUrlParseRequest = {
      url,
      language,
    };

    this.logger.log('Creating Agent API task...');
    const result = await this.client.agentParseUrl(request, {
      pollInterval,
      timeout,
    });

    return {
      markdown: result.markdown || '',
      images: [],
      taskId: result.task_id,
      downloadedFiles: [],
    };
  }

  /**
   * Extract content from local PDF file
   */
  async extractFromFile(
    filePath: string,
    options: Omit<PdfExtractOptions, 'url' | 'filePath'> = {},
  ): Promise<PdfExtractResult> {
    const { language = 'ch', useAgentApi = true } = options;

    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const fileName = path.basename(filePath);
    this.logger.log(`Extracting content from local file: ${fileName}`);

    if (useAgentApi) {
      // Agent API: upload file first
      return this.extractFileUsingAgentApi(filePath, language);
    } else {
      // Precision API: requires S3 upload (not implemented here)
      throw new Error('Local file extraction with Precision API requires S3 upload. Use Agent API instead.');
    }
  }

  /**
   * Extract local file using Agent API
   */
  private async extractFileUsingAgentApi(
    filePath: string,
    language: string,
  ): Promise<PdfExtractResult> {
    const fileName = path.basename(filePath);
    // Get upload URL
    const { task_id, file_url } = await this.client.agentGetUploadUrl(fileName);
    this.logger.log(`Got upload URL for task: ${task_id}`);

    // Upload file
    await this.client.agentUploadFile(filePath, file_url);
    this.logger.log('File uploaded successfully');

    // Poll for result
    let result = await this.client.agentGetTaskResult(task_id);
    const startTime = Date.now();
    const timeout = 300000;

    while (result.state !== 'done' && result.state !== 'failed') {
      if (Date.now() - startTime > timeout) {
        throw new Error(`Task ${task_id} timed out`);
      }
      await new Promise((resolve) => setTimeout(resolve, 5000));
      result = await this.client.agentGetTaskResult(task_id);
      this.logger.log(`Task ${task_id} state: ${result.state}`);
    }

    if (result.state === 'failed') {
      throw new Error(`Task failed: ${result.err_msg}`);
    }

    return {
      markdown: result.markdown || '',
      images: [],
      taskId: task_id,
      downloadedFiles: [],
    };
  }

  /**
   * Validate token for Precision API
   */
  async validateToken(): Promise<boolean> {
    if (!this.client.config.token) {
      return false;
    }
    return this.client.validateToken();
  }

  /**
   * Get task result by ID (Precision API)
   */
  async getTaskResult(taskId: string) {
    return this.client.getTaskResult(taskId);
  }
}
