import axios from "axios";
import {
  createAsyncTask,
  fetchTaskStatus,
  waitForTaskCompletion,
  BatchTextEmbeddingModel,
  TextType,
  TaskStatus,
  CreateAsyncTaskResponse,
  FetchTaskStatusResponse,
} from "../async_embedding";

// Mock axios
jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe("Async Embedding API", () => {
  const mockApiKey = "test-api-key";
  const mockTaskId = "test-task-id";
  const mockFileUrl = "https://example.com/test_file.txt";

  beforeAll(() => {
    process.env.ALIBABA_API_KEY = mockApiKey;
  });

  afterAll(() => {
    delete process.env.ALIBABA_API_KEY;
  });

  beforeEach(() => {
    mockedAxios.post.mockClear();
    mockedAxios.get.mockClear();
  });

  describe("createAsyncTask", () => {
    it("should successfully create an async task", async () => {
      const mockResponse: CreateAsyncTaskResponse = {
        request_id: "req-123",
        output: {
          task_id: mockTaskId,
          task_status: TaskStatus.Pending,
        },
      };
      mockedAxios.post.mockResolvedValueOnce({ data: mockResponse });

      const result = await createAsyncTask(
        BatchTextEmbeddingModel.TextEmbeddingV1,
        mockFileUrl,
        TextType.Document,
      );

      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        "https://dashscope.aliyuncs.com/api/v1/services/embeddings/text-embedding/text-embedding",
        {
          model: BatchTextEmbeddingModel.TextEmbeddingV1,
          input: { url: mockFileUrl },
          parameters: { text_type: TextType.Document },
        },
        {
          headers: {
            Authorization: `Bearer ${mockApiKey}`,
            "Content-Type": "application/json",
            "X-DashScope-Async": "enable",
          },
        },
      );
      expect(result).toEqual(mockResponse);
    });

    it("should throw an error if API key is not set", async () => {
      delete process.env.ALIBABA_API_KEY;
      await expect(
        createAsyncTask(BatchTextEmbeddingModel.TextEmbeddingV1, mockFileUrl),
      ).rejects.toThrow("ALIBABA_API_KEY is not set in environment variables.");
      process.env.ALIBABA_API_KEY = mockApiKey; // Restore for other tests
    });

    it("should handle API errors", async () => {
      const mockErrorResponse: CreateAsyncTaskResponse = {
        request_id: "err-req-456",
        code: "InvalidParameter",
        message: "Invalid URL provided.",
        output: null,
      };
      mockedAxios.post.mockImplementationOnce(() => {
        const error: any = new Error("Request failed with status code 400");
        error.isAxiosError = true;
        error.response = {
          data: mockErrorResponse,
          status: 400,
          statusText: "Bad Request",
          headers: {},
          config: {},
        };
        return Promise.reject(error);
      });

      await expect(
        createAsyncTask(BatchTextEmbeddingModel.TextEmbeddingV1, "invalid-url"),
      ).rejects.toThrow("Request failed with status code 400");
    });
  });

  describe("fetchTaskStatus", () => {
    it("should successfully fetch task status", async () => {
      const mockResponse: FetchTaskStatusResponse = {
        request_id: "req-789",
        output: {
          task_id: mockTaskId,
          task_status: TaskStatus.Running,
        },
      };
      mockedAxios.get.mockResolvedValueOnce({ data: mockResponse });

      const result = await fetchTaskStatus(mockTaskId);

      expect(mockedAxios.get).toHaveBeenCalledTimes(1);
      expect(mockedAxios.get).toHaveBeenCalledWith(
        `https://dashscope.aliyuncs.com/api/v1/tasks/${mockTaskId}`,
        {
          headers: {
            Authorization: `Bearer ${mockApiKey}`,
          },
        },
      );
      expect(result).toEqual(mockResponse);
    });

    it("should throw an error if API key is not set", async () => {
      delete process.env.ALIBABA_API_KEY;
      await expect(fetchTaskStatus(mockTaskId)).rejects.toThrow(
        "ALIBABA_API_KEY is not set in environment variables.",
      );
      process.env.ALIBABA_API_KEY = mockApiKey; // Restore for other tests
    });

    it("should handle API errors", async () => {
      const mockErrorResponse: FetchTaskStatusResponse = {
        request_id: "err-req-012",
        code: "TaskNotFound",
        message: "Task not found.",
        output: null,
      };
      mockedAxios.get.mockImplementationOnce(() => {
        const error: any = new Error("Request failed with status code 404");
        error.isAxiosError = true;
        error.response = {
          data: mockErrorResponse,
          status: 404,
          statusText: "Not Found",
          headers: {},
          config: {},
        };
        return Promise.reject(error);
      });

      await expect(fetchTaskStatus("non-existent-task")).rejects.toThrow(
        "Request failed with status code 404",
      );
    });
  });

  describe("waitForTaskCompletion", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers(); // Restore real timers after each test
    });

    it("should resolve when task succeeds", async () => {
      mockedAxios.get
        .mockResolvedValueOnce({
          // First poll (Running)
          data: {
            request_id: "req-1",
            output: { task_id: mockTaskId, task_status: TaskStatus.Running },
          },
        })
        .mockResolvedValueOnce({
          // Second poll (Success)
          data: {
            request_id: "req-2",
            output: {
              task_id: mockTaskId,
              task_status: TaskStatus.Succeeded,
              url: "http://result.url",
            },
          },
        });

      const promise = waitForTaskCompletion(mockTaskId, 100);

      // First poll
      jest.runOnlyPendingTimers();
      await Promise.resolve();

      // Second poll (success)
      jest.runOnlyPendingTimers();
      await Promise.resolve();

      const result = await promise;
      expect(mockedAxios.get).toHaveBeenCalledTimes(2);
      expect(result.output?.task_status).toBe(TaskStatus.Succeeded);
    }, 10000); // Increased timeout to 10s

    it("should reject when task fails", async () => {
      mockedAxios.get
        .mockResolvedValueOnce({
          // First poll (Running)
          data: {
            request_id: "req-fail-1",
            output: { task_id: mockTaskId, task_status: TaskStatus.Running },
          },
        })
        .mockResolvedValueOnce({
          // Second poll (Failed)
          data: {
            request_id: "req-fail-2",
            output: {
              task_id: mockTaskId,
              task_status: TaskStatus.Failed,
              message: "Task processing failed",
            },
          },
        });

      const promise = waitForTaskCompletion(mockTaskId, 100);

      // First poll
      jest.runOnlyPendingTimers();
      await Promise.resolve();

      // Second poll (failure)
      jest.runOnlyPendingTimers();
      await Promise.resolve();

      await expect(promise).rejects.toThrow(
        "Task test-task-id failed with status: FAILED",
      );
      expect(mockedAxios.get).toHaveBeenCalledTimes(2);
    });

    it("should reject on timeout", async () => {
      mockedAxios.get.mockResolvedValue({
        // Mock ongoing running status
        data: {
          request_id: "req-timeout",
          output: { task_id: mockTaskId, task_status: TaskStatus.Running },
        },
      });

      const promise = waitForTaskCompletion(mockTaskId, 100, 200);

      // Initial poll
      jest.runOnlyPendingTimers();
      await Promise.resolve();

      // Advance time past timeout
      jest.advanceTimersByTime(300);

      await expect(promise).rejects.toThrow(
        `Task ${mockTaskId} timed out after 200ms. Last status: RUNNING`,
      );
    });

    it("should reject immediately if fetchTaskStatus throws an error", async () => {
      const mockError = new Error("Network error");
      mockedAxios.get.mockRejectedValue(mockError);

      const promise = waitForTaskCompletion(mockTaskId, 100);

      jest.runOnlyPendingTimers();
      await Promise.resolve();

      await expect(promise).rejects.toThrow(mockError);
      expect(mockedAxios.get).toHaveBeenCalledTimes(1);
    });
  });
});
