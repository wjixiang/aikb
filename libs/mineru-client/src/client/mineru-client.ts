import axios, { AxiosInstance } from 'axios';

import type { MinerUConfig } from '../types';
import type { ApiResponse } from '../types';
import { MinerUApiError, MinerUTimeoutError } from '../errors';
import {
  MINERU_DEFAULT_CONFIG,
  resolveConfig,
  isValidFileFormat,
  getSupportedLanguages,
} from '../constants';
import { createLogger } from '../utils';
import { PrecisionApiMixin } from './precision-api';
import { AgentApiMixin } from './agent-api';

// ---- Base class ----

class MinerUClientBase {
  public precisionClient: AxiosInstance;
  public agentClient: AxiosInstance;
  public config: ReturnType<typeof resolveConfig>;
  public logger: ReturnType<typeof createLogger>;

  constructor(config: MinerUConfig) {
    const resolved = resolveConfig(config);

    // Precision API client (requires token)
    this.precisionClient = axios.create({
      baseURL: resolved.baseUrl,
      timeout: resolved.timeout,
      headers: {
        'Content-Type': 'application/json',
        Accept: '*/*',
      },
    });

    if (resolved.token) {
      this.precisionClient.defaults.headers.common[
        'Authorization'
      ] = `Bearer ${resolved.token}`;
    }

    // Agent API client (no auth required)
    this.agentClient = axios.create({
      baseURL: resolved.agentBaseUrl,
      timeout: resolved.timeout,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Interceptors
    const handleError = (error: any) => this.handleApiError(error);
    this.precisionClient.interceptors.response.use(
      (response) => response,
      handleError,
    );
    this.agentClient.interceptors.response.use(
      (response) => response,
      handleError,
    );

    this.config = resolved;
    this.logger = createLogger({ component: 'MinerUClient' });
  }

  private handleApiError(error: any): never {
    if (error.response) {
      const { data, status, headers } = error.response;
      const errorMessage = data.msg || data.message || `HTTP ${status} error`;
      const errorCode = data.code || this.getErrorCodeFromStatus(status);

      this.logger.error(
        {
          status,
          errorCode,
          errorMessage,
          traceId: data.trace_id,
          url: error.config?.url,
          method: error.config?.method,
        },
        'MinerU API Error',
      );

      throw new MinerUApiError(errorCode, errorMessage, data.trace_id);
    } else if (error.request) {
      this.logger.error(
        {
          message: error.message,
          code: error.code,
          url: error.config?.url,
          method: error.config?.method,
          timeout: error.config?.timeout,
        },
        'MinerU Network Error',
      );
      throw new MinerUTimeoutError(
        `Network request failed: ${error.message}`,
      );
    } else {
      this.logger.error(
        { message: error.message, stack: error.stack },
        'MinerU Request Error',
      );
      throw new MinerUTimeoutError(`Request failed: ${error.message}`);
    }
  }

  private getErrorCodeFromStatus(status: number): string {
    switch (status) {
      case 400:
        return 'BAD_REQUEST';
      case 401:
        return 'UNAUTHORIZED';
      case 403:
        return 'FORBIDDEN';
      case 404:
        return 'NOT_FOUND';
      case 429:
        return 'RATE_LIMITED';
      case 500:
        return 'INTERNAL_SERVER_ERROR';
      case 502:
        return 'BAD_GATEWAY';
      case 503:
        return 'SERVICE_UNAVAILABLE';
      default:
        return `HTTP_${status}`;
    }
  }
}

// ---- Apply mixins ----

export class MinerUClient extends PrecisionApiMixin(
  AgentApiMixin(MinerUClientBase),
) {
  /**
   * Validate file format
   */
  static isValidFileFormat = isValidFileFormat;

  /**
   * Get supported languages
   */
  static getSupportedLanguages = getSupportedLanguages;
}
