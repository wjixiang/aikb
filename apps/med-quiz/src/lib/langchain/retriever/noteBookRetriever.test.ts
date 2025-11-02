import { NotebookRetriever, retrieveTextBookSource } from "./noteBookRetriever";
import { Document } from "@langchain/core/documents";

describe("NotebookRetriever", () => {
  const mockOptions = {
    minSimilarityScore: 0.5,
    maxK: 10,
    salientTerms: ["test"],
    vectorWeight: 0.7,
    bm25Weight: 0.3,
    hybridSearch: true,
    useBM25: true,
    maxBM25Results: 5,
  };

  const mockVectorResults: Document<retrieveTextBookSource>[] = [
    new Document({
      pageContent: "vector result 1",
      metadata: {
        title: "Doc 1",
        chunkId: "v1",
        score: 0.9,
        scoreSource: "vector" as const,
      },
    }),
  ];

  const mockBM25Results: Document<retrieveTextBookSource>[] = [
    new Document({
      pageContent: "bm25 result 1",
      metadata: {
        title: "Doc 1",
        chunkId: "v1",
        score: 0.85,
        scoreSource: "bm25" as const,
      },
    }),
  ];

  describe("hybrid search", () => {
    it("should enable/disable hybrid search based on config", async () => {
      const hybridRetriever = new NotebookRetriever("test", {
        ...mockOptions,
        hybridSearch: true,
      });
      const vectorOnlyRetriever = new NotebookRetriever("test", {
        ...mockOptions,
        hybridSearch: false,
      });

      expect(hybridRetriever.options.hybridSearch).toBe(true);
      expect(vectorOnlyRetriever.options.hybridSearch).toBe(false);
    });
  });

  describe("BM25 integration", () => {
    it("should call BM25 when enabled", async () => {
      const retriever = new NotebookRetriever("test", mockOptions);
      jest
        .spyOn(retriever, "getBM25Results")
        .mockResolvedValue(mockBM25Results);
      jest
        .spyOn(retriever, "getRetrievedChunks")
        .mockResolvedValue(mockVectorResults);

      await retriever.getRelevantDocuments("test query");

      expect(retriever.getBM25Results).toHaveBeenCalled();
    });

    it("should skip BM25 when disabled", async () => {
      const retriever = new NotebookRetriever("test", {
        ...mockOptions,
        useBM25: false,
      });
      jest.spyOn(retriever, "getBM25Results");
      jest
        .spyOn(retriever, "getRetrievedChunks")
        .mockResolvedValue(mockVectorResults);

      await retriever.getRelevantDocuments("test query");

      expect(retriever.getBM25Results).not.toHaveBeenCalled();
    });
  });

  describe("result format", () => {
    it("should standardize result format with score metadata", async () => {
      const retriever = new NotebookRetriever("test", mockOptions);
      jest
        .spyOn(retriever, "getBM25Results")
        .mockResolvedValue(mockBM25Results);
      jest
        .spyOn(retriever, "getRetrievedChunks")
        .mockResolvedValue(mockVectorResults);

      const results = await retriever.getRelevantDocuments("test query");

      expect(results[0].metadata).toMatchObject({
        title: expect.any(String),
        chunkId: expect.any(String),
        score: expect.any(Number),
        scoreSource: expect.stringMatching(/vector|bm25|hybrid/),
      });
    });
  });
});
