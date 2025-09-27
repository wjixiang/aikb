import { describe, it, expect, vi, beforeEach } from 'vitest';
import WikiEntryProxy from './wikiEntryProxy';
import axios from 'axios';

// Mock axios
vi.mock('axios');

describe(WikiEntryProxy, () => {
  let wikiProxy: WikiEntryProxy;

  beforeEach(() => {
    vi.clearAllMocks();
    wikiProxy = new WikiEntryProxy({});
  });

  it('Search wikipedia and return parsed text', async () => {
    // Mock the axios response
    // const mockResponse = {
    //     data: [
    //         "Artificial Intelligence", // search term
    //         ["Artificial intelligence", "Machine learning", "Deep learning"], // titles
    //         ["Artificial intelligence is intelligence demonstrated by machines...", "Machine learning is a method of data analysis...", "Deep learning is part of a broader family..."], // descriptions
    //         ["https://en.wikipedia.org/wiki/Artificial_intelligence", "https://en.wikipedia.org/wiki/Machine_learning", "https://en.wikipedia.org/wiki/Deep_learning"] // urls
    //     ]
    // };
    // vi.mocked(axios.get).mockResolvedValue(mockResponse);
    // const result = await wikiProxy.search();
    // expect(result).toContain("Title: Artificial intelligence");
    // expect(result).toContain("Description: Artificial intelligence is intelligence demonstrated by machines...");
    // expect(result).toContain("URL: https://en.wikipedia.org/wiki/Artificial_intelligence");
    // expect(result).toContain("Title: Machine learning");
    // expect(result).toContain("Title: Deep learning");
  });

  // it("Should handle empty search results", async () => {
  //     // Mock empty response
  //     const mockResponse = {
  //         data: [
  //             "Nonexistent Term", // search term
  //             [], // empty titles
  //             [], // empty descriptions
  //             []  // empty urls
  //         ]
  //     };

  //     vi.mocked(axios.get).mockResolvedValue(mockResponse);

  //     const result = await wikiProxy.search();

  //     expect(result).toBe("No Wikipedia articles found for the search query.");
  // });

  // it("Should handle API errors", async () => {
  //     // Mock API error
  //     vi.mocked(axios.get).mockRejectedValue(new Error("Network error"));

  //     await expect(wikiProxy.search()).rejects.toThrow("Failed to search Wikipedia: Network error");
  // });
});
