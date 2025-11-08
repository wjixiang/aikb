// Import TextSplitter normally
// Mock the provider module
jest.mock('./provider', () => ({
  getChatModel: jest.fn().mockReturnValue({
    invoke: jest.fn().mockResolvedValue({ content: '' }), // Default mock response
  }),
}));

import TextSplitter from '../spliter';

describe('TextSplitter', () => {
  let splitter: TextSplitter;

  beforeEach(() => {
    splitter = new TextSplitter();
    // We will mock specific methods in relevant describe blocks
  });

  // --- lengthSplit Tests ---
  describe('lengthSplit', () => {
    it('should split text into chunks of specified length', () => {
      const text =
        'This is the first sentence. This is the second sentence. This is the third sentence.';
      const splitLength = 40;
      const windowLength = 10;
      const chunks = splitter.lengthSplit(text, splitLength, windowLength);

      expect(chunks.length).toBeGreaterThan(1);
      chunks.forEach((chunk) => {
        expect(chunk.content.length).toBeLessThanOrEqual(
          splitLength + windowLength,
        ); // Allow for some flexibility due to sentence boundaries/overlap
        // A more precise check might be needed depending on exact behavior with overlap
      });
      // Example precise check for the first chunk (adjust based on actual output)
      expect(chunks[0].content).toBe('This is the first sentence.'); // Assuming this fits
    });

    it('should handle overlap correctly', () => {
      const text =
        'Sentence one. Sentence two, which is a bit longer. Sentence three.';
      const splitLength = 30;
      const windowLength = 15; // Overlap should include part of "Sentence two..."
      const chunks = splitter.lengthSplit(text, splitLength, windowLength);

      expect(chunks.length).toBe(3); // Implementation creates 3 chunks for this case
      // Check chunk contents
      expect(chunks[0].content).toBe('Sentence one.');
      expect(chunks[1].content).toBe('Sentence two, which is a bit l');
      expect(chunks[2].content).toBe('Sentence three.');
    });

    it('should handle text shorter than splitLength', () => {
      const text = 'Short text.';
      const chunks = splitter.lengthSplit(text, 100, 20);
      expect(chunks.length).toBe(1);
      expect(chunks[0].content).toBe(text);
    });

    it('should handle a single sentence longer than splitLength (truncation expected)', () => {
      const text =
        'This single sentence is definitely longer than the tiny split length.';
      const splitLength = 20;
      const windowLength = 5;
      const chunks = splitter.lengthSplit(text, splitLength, windowLength);
      expect(chunks.length).toBe(1); // The long sentence becomes one chunk
      expect(chunks[0].content.length).toBe(splitLength); // It should be truncated
      expect(chunks[0].content).toBe('This single sentence'); // Check truncated content
    });

    it('should handle empty text', () => {
      const text = '';
      const chunks = splitter.lengthSplit(text, 100, 20);
      expect(chunks.length).toBe(0);
    });
  });

  // --- patternSplit Tests ---
  describe('patternSplit', () => {
    const text = `
1. First item? This is the content for the first item. It spans multiple lines.
2. Second item? Content for second.
3. Third item? A very long content for the third item that will definitely exceed the chunk size limit and therefore should be split further using the sliding window approach. This ensures that large sections matched by the pattern are still broken down appropriately. More text to make it longer.
4. Fourth item? Short content.`;
    // Pattern: Number. Question? Content (until next Number. or end)
    const pattern = /(\d+)\.\s*(.*?)\?\s*([\s\S]*?)(?=\n\d+\.\s*|$)/g; // Replaced . with [\s\S] for dotAll, removed 's' flag
    const groupMapping = { header: 1, name: 2, content: 3 };
    const chunkSize = 100;
    const windowSize = 20;

    it('should split text based on the pattern', () => {
      const chunks = splitter.patternSplit(
        text,
        pattern,
        groupMapping,
        1000,
        100,
      ); // Large chunksize to avoid windowing initially
      expect(chunks.length).toBe(4);
      expect(chunks[0].header).toBe('1');
      expect(chunks[0].name).toBe('First item');
      expect(chunks[0].content).toBe(
        'This is the content for the first item. It spans multiple lines.',
      );
      expect(chunks[1].name).toBe('Second item');
      expect(chunks[2].name).toBe('Third item');
      expect(chunks[3].name).toBe('Fourth item');
      expect(chunks[3].content).toBe('Short content.');
    });

    it('should apply sliding window to chunks exceeding chunkSize', () => {
      const chunks = splitter.patternSplit(
        text,
        pattern,
        groupMapping,
        chunkSize,
        windowSize,
      );
      // Expect more chunks because the 3rd item's content was split
      expect(chunks.length).toBeGreaterThan(4);

      // Find the chunks related to the original "Third item"
      const thirdItemChunks = chunks.filter((c) => c.header === '3');
      expect(thirdItemChunks.length).toBeGreaterThan(1); // It should have been split

      // Check if the content seems reasonably split and overlaps
      expect(thirdItemChunks[0].content.length).toBeLessThanOrEqual(
        chunkSize + windowSize,
      ); // Approximate check
      expect(thirdItemChunks[1].content.length).toBeLessThanOrEqual(
        chunkSize + windowSize,
      );
      expect(thirdItemChunks[0].name).toBe('Third item-p1');
      expect(thirdItemChunks[1].name).toBe('Third item-p2');
      // A more precise check could verify the overlap content
    });

    it('should handle no matches found', () => {
      const nonMatchingText = 'Just some regular text without the pattern.';
      const chunks = splitter.patternSplit(
        nonMatchingText,
        pattern,
        groupMapping,
        chunkSize,
        windowSize,
      );
      expect(chunks.length).toBe(1); // Returns the whole text as one chunk
      expect(chunks[0].content).toBe(nonMatchingText);
      expect(chunks[0].name).toBe('Full Text (No Pattern Match)');
    });

    it('should handle regex without global flag (warning expected)', () => {
      const localPattern = /(\d+)\.\s*(.*?)\?\s*([\s\S]*?)(?=\n\d+\.\s*|$)/; // Replaced . with [\s\S] for dotAll, removed 's' flag
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(); // Suppress warning in test output
      const chunks = splitter.patternSplit(
        text,
        localPattern,
        groupMapping,
        1000,
        100,
      );
      // It should still work because the code attempts to add the 'g' flag
      expect(chunks.length).toBe(4);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          "Pattern regex should have the global 'g' flag",
        ),
      );
      consoleWarnSpy.mockRestore();
    });
  });

  // --- outlineSplit Tests (Requires Mocking) ---
  describe('outlineSplit', () => {
    // Note: These tests rely on the top-level mock of callLlm

    // Test case structure - needs actual implementation
    it.skip('should split based on LLM outline response', async () => {
      // TODO: Implement test
      // 1. Define mock LLM response for outline
      // mockCallLlm.mockResolvedValueOnce(...)
      // 2. Call splitter.outlineSplit(...)
      // 3. Assert expectations on the returned chunks
    });

    it.skip('should merge small chunks correctly', async () => {
      // TODO: Implement test
    });

    it.skip('should handle no outlines returned', async () => {
      // TODO: Implement test
    });
  });
  // --- semanticSplit Tests (Real LLM Calls) ---
  describe('semanticSplit', () => {
    beforeEach(() => {
      splitter = new TextSplitter();
    });

    it('should split based on LLM semantic analysis', async () => {
      const text = '引言部分内容\n背景介绍内容\n方法论内容';
      const chunks = await splitter.semanticSplit(text, 20, 'zh');

      // Basic validation of LLM response structure
      expect(chunks.length).toBeGreaterThan(0);
      chunks.forEach((chunk) => {
        expect(chunk).toHaveProperty('name');
        expect(chunk).toHaveProperty('content');
        expect(chunk.content.length).toBeLessThanOrEqual(20);
      });
    });

    it('should recursively split large segments', async () => {
      const text =
        '这是一个很长的文本内容，应该会被递归分割成多个小段。这是第二段内容，也很长。这是第三段内容。';
      const chunks = await splitter.semanticSplit(text, 20, 'zh');

      // Verify recursion happened by checking for generated names
      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks.some((c) => c.name.includes('.'))).toBeTruthy();

      // Verify all chunks are within size limit
      chunks.forEach((chunk) => {
        expect(chunk.content.length).toBeLessThanOrEqual(20);
      });
    });

    it('should handle LLM errors gracefully', async () => {
      // Mock the LLM to simulate an error
      const mockInvoke = jest.fn().mockRejectedValue(new Error('LLM error'));
      const mockGetChatModel = jest
        .fn()
        .mockReturnValue({ invoke: mockInvoke });
      require('./provider').getChatModel = mockGetChatModel;

      const text = 'Test text for error handling';
      const chunks = await splitter.semanticSplit(text, 10, 'en');

      // Should fall back to length-based splitting
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].name).toMatch(/section/);

      // Restore original implementation
      require('./provider').getChatModel.mockRestore();
    });

    it('should handle empty LLM responses', async () => {
      // Mock the LLM to return empty response
      const mockInvoke = jest.fn().mockResolvedValue({ content: '' });
      const mockGetChatModel = jest
        .fn()
        .mockReturnValue({ invoke: mockInvoke });
      require('./provider').getChatModel = mockGetChatModel;

      const text = 'Test text for empty response';
      const chunks = await splitter.semanticSplit(text, 10, 'en');

      // Should fall back to length-based splitting
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].name).toMatch(/section/);

      // Restore original implementation
      require('./provider').getChatModel.mockRestore();
    });
  }); // Close 'semanticSplit' describe block
});
