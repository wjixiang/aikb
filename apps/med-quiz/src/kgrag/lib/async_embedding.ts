import axios from "axios";
import * as dotenv from "dotenv";
dotenv.config();

const DASHSCOPE_SUBMIT_TASK_URL =
  "https://dashscope.aliyuncs.com/api/v1/services/embeddings/text-embedding/text-embedding";
const DASHSCOPE_FETCH_TASK_URL = "https://dashscope.aliyuncs.com/api/v1/tasks";

export enum BatchTextEmbeddingModel {
  TextEmbeddingV1 = "text-embedding-v1",
  TextEmbeddingV2 = "text-embedding-v2",
  TextEmbeddingAsyncV1 = "text-embedding-async-v1",
  TextEmbeddingAsyncV2 = "text-embedding-async-v2",
}

export enum TextType {
  Document = "document",
  Query = "query",
}

export enum TaskStatus {
  Succeeded = "SUCCEEDED",
  Failed = "FAILED",
  Canceled = "CANCELED",
  Pending = "PENDING",
  Suspended = "SUSPENDED",
  Running = "RUNNING",
  Unknown = "UNKNOWN", // From documentation for fetch status
}

interface CreateAsyncTaskRequest {
  model: BatchTextEmbeddingModel;
  input: {
    url: string;
  };
  parameters?: {
    text_type?: TextType;
  };
}

interface CreateAsyncTaskOutput {
  task_id: string;
  task_status: TaskStatus;
  url?: string; // Only present on SUCCEEDED
  submit_time?: string;
  scheduled_time?: string;
  end_time?: string;
  code?: string; // Error code for failed tasks
  message?: string; // Error message for failed tasks
}

interface Usage {
  total_tokens: number;
}

interface DashScopeResponse<T> {
  status_code?: number; // From SDK examples, not always in HTTP API
  request_id: string;
  code?: string; // Error code
  message?: string; // Error message
  output: T | null;
  usage?: Usage;
}

export type CreateAsyncTaskResponse = DashScopeResponse<CreateAsyncTaskOutput>;
export type FetchTaskStatusResponse = DashScopeResponse<CreateAsyncTaskOutput>;

/**
 * Submits a new asynchronous text embedding job.
 * @param model The embedding model to use.
 * @param url The URL of the file containing text to embed.
 * @param textType The type of text (query or document). Defaults to 'document'.
 * @returns A promise that resolves to the task creation response.
 */
export async function createAsyncTask(
  model: BatchTextEmbeddingModel,
  url: string,
  textType: TextType = TextType.Document,
): Promise<CreateAsyncTaskResponse> {
  const apiKey = process.env.ALIBABA_API_KEY;
  if (!apiKey) {
    throw new Error("ALIBABA_API_KEY is not set in environment variables.");
  }

  const requestBody: CreateAsyncTaskRequest = {
    model,
    input: { url },
    parameters: { text_type: textType },
  };

  try {
    const response = await axios.post<CreateAsyncTaskResponse>(
      `${DASHSCOPE_SUBMIT_TASK_URL}`,
      requestBody,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "X-DashScope-Async": "enable",
        },
      },
    );
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      console.error("Error creating async task:", error.response.data);
      throw error;
    }
    throw error;
  }
}

/**
 * Fetches the status and result of an asynchronous text embedding job.
 * @param taskId The ID of the task to query.
 * @returns A promise that resolves to the task status response.
 */
export async function fetchTaskStatus(
  taskId: string,
): Promise<FetchTaskStatusResponse> {
  const apiKey = process.env.ALIBABA_API_KEY;
  if (!apiKey) {
    throw new Error("DASHSCOPE_API_KEY is not set in environment variables.");
  }

  try {
    const response = await axios.get<FetchTaskStatusResponse>(
      `${DASHSCOPE_FETCH_TASK_URL}/${taskId}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      },
    );
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      console.error(
        `Error fetching task status for ${taskId}:`,
        error.response.data,
      );
      throw error;
    }
    throw error;
  }
}

/**
 * Polls the task status until it's SUCCEEDED or FAILED.
 * @param taskId The ID of the task to wait for.
 * @param intervalMs The polling interval in milliseconds. Defaults to 5000ms.
 * @param timeoutMs The maximum time to wait in milliseconds. Defaults to 300000ms (5 minutes).
 * @returns A promise that resolves to the final task status response.
 */
export async function waitForTaskCompletion(
  taskId: string,
  intervalMs: number = 5000,
  timeoutMs: number = 300000,
): Promise<FetchTaskStatusResponse> {
  const startTime = Date.now();

  return new Promise((resolve, reject) => {
    let lastStatus: TaskStatus | undefined;

    const poll = async () => {
      try {
        const statusResponse = await fetchTaskStatus(taskId);
        const taskStatus = statusResponse.output?.task_status;
        lastStatus = taskStatus;

        // Check timeout first
        if (Date.now() - startTime > timeoutMs) {
          return reject(
            new Error(
              `Task ${taskId} timed out after ${timeoutMs}ms. Last status: ${lastStatus || "unknown"}`,
            ),
          );
        }

        // Then check task status
        if (taskStatus === TaskStatus.Succeeded) {
          return resolve(statusResponse);
        }
        if (taskStatus === TaskStatus.Failed) {
          const errorCode = statusResponse.output?.code;
          const errorMessage = statusResponse.output?.message;
          return reject(
            new Error(
              `Task ${taskId} failed with status: ${taskStatus}. Code: ${errorCode || "N/A"}, Message: ${errorMessage || "N/A"}`,
            ),
          );
        }

        setTimeout(poll, intervalMs);
      } catch (error) {
        // If we get an error from fetchTaskStatus, reject immediately
        // without checking task status
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    };

    // Start polling immediately
    poll();
  });
}

// Interface for the content of the result file (JSONL format)
export interface EmbeddingResultItem {
  output: {
    code: number;
    embedding: number[];
    message: string;
    request_id: string;
    text_index: number;
    usage: {
      total_tokens: number;
    };
  };
}
