import { NoteRetriever } from "../hybridRetriever";
import { Document } from "@langchain/core/documents";

describe("NoteRetriever", () => {
  const mockOptions = {
    minSimilarityScore: 0.5,
    maxK: 10,
    salientTerms: ["test"],
    vectorWeight: 0.7,
    bm25Weight: 0.3,
    useBM25: true,
    maxBM25Results: 5,
    stagedSearch: true,
    firstStageK: 20,
  };

  const mockVectorResults = [
    new Document({
      pageContent: "vector result 1",
      metadata: { chunkId: "v1", score: 0.9, content: "vector result 1" },
    }),
    new Document({
      pageContent: "vector result 2",
      metadata: { chunkId: "v2", score: 0.8, content: "vector result 2" },
    }),
  ];

  const mockBM25Results = [
    new Document({
      pageContent: "bm25 result 1",
      metadata: { chunkId: "b1", score: 0.85, content: "bm25 result 1" },
    }),
    new Document({
      pageContent: "bm25 result 2",
      metadata: { chunkId: "v2", score: 0.75, content: "bm25 result 2" }, // overlaps with vector result 2
    }),
  ];

  describe("combineResults", () => {
    it("should correctly combine and weight results", async () => {
      const retriever = new NoteRetriever({
        ...mockOptions,
        minSimilarityScore: 0.1, // Lower threshold for test
      });
      const combined = await retriever.combineResults(
        mockVectorResults,
        mockBM25Results,
      );

      expect(combined).toHaveLength(3);

      // Check combined scores
      const v2Result = combined.find((d) => d.metadata.chunkId === "v2");
      expect(v2Result?.metadata.combinedScore).toBeCloseTo(
        0.8 * 0.7 + 0.75 * 0.3,
      );
      expect(v2Result?.metadata.scoreSource).toBe("hybrid");
    });

    it("should return vector results only when BM25 is disabled", async () => {
      const retriever = new NoteRetriever({
        ...mockOptions,
        useBM25: false,
        minSimilarityScore: 0.1, // Lower threshold for test
      });
      const combined = await retriever.combineResults(
        mockVectorResults,
        mockBM25Results,
      );

      expect(combined).toEqual(mockVectorResults);
    });
  });

  describe("stagedSearch", () => {
    it("should perform two-stage search when enabled", async () => {
      const retriever = new NoteRetriever(mockOptions);
      const mockGetOramaChunks = jest
        .spyOn(retriever, "getOramaChunks")
        .mockResolvedValueOnce(mockVectorResults) // first stage
        .mockResolvedValueOnce([mockVectorResults[0]]); // second stage

      const results = await retriever.stagedSearch("test query");

      expect(mockGetOramaChunks).toHaveBeenCalledTimes(2);
      expect(results).toHaveLength(1);
    });

    it("should perform single search when disabled", async () => {
      const retriever = new NoteRetriever({
        ...mockOptions,
        stagedSearch: false,
      });
      const mockGetOramaChunks = jest
        .spyOn(retriever, "getOramaChunks")
        .mockResolvedValue(mockVectorResults);

      const results = await retriever.stagedSearch("test query");

      expect(mockGetOramaChunks).toHaveBeenCalledTimes(1);
      expect(results).toEqual(mockVectorResults);
    });
  });

  describe("performance benchmarks", () => {
    it("should complete hybrid search under 500ms", async () => {
      const retriever = new NoteRetriever(mockOptions);
      jest
        .spyOn(retriever, "getOramaChunks")
        .mockResolvedValue(mockVectorResults);
      jest
        .spyOn(retriever, "getBM25Results")
        .mockResolvedValue(mockBM25Results);

      const start = performance.now();
      await retriever.getRelevantDocuments("test query");
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(500);
    });
  });
});
