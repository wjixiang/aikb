import { describe, test, expect, vi } from 'vitest';
import { QuizParser } from './QuizParser';

describe('QuizParser chunking', () => {
  const sampleQuestions = `1. What is the capital of France?
A. London
B. Berlin
C. Paris
D. Madrid

2. Which planet is known as the Red Planet?
A. Venus
B. Mars
C. Jupiter
D. Saturn

3. What is the largest mammal in the world?
A. Elephant
B. Blue Whale
C. Giraffe
D. Hippopotamus

4. Who painted the Mona Lisa?
A. Vincent van Gogh
B. Pablo Picasso
C. Leonardo da Vinci
D. Michelangelo

5. What is the smallest prime number?
A. 0
B. 1
C. 2
D. 3`;

  const sampleAnswers = `1. C
2. B
3. B
4. C
5. C`;

  test('should return original parser when chunkNum is 1', async () => {
    const parser = new QuizParser(sampleQuestions, sampleAnswers);
    const chunks = await parser.chunkInput(1);
    
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toBe(parser);
  });

  test('should split input into specified number of chunks', async () => {
    // Mock the b.SplitPage function to avoid actual API calls
    const { b } = await import('../baml_client/async_client');
    const mockSplitPage = vi.fn()
      .mockResolvedValue([{ start: 1, end: 15 }, { start: 16, end: 30 }]);
    b.SplitPage = mockSplitPage;
    
    const parser = new QuizParser(sampleQuestions, sampleAnswers);
    const chunks = await parser.chunkInput(2);
    
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toBeInstanceOf(QuizParser);
    expect(chunks[1]).toBeInstanceOf(QuizParser);
  }, 10000); // Increase timeout to 10 seconds

  test('should handle error gracefully', async () => {
    const parser = new QuizParser(sampleQuestions, sampleAnswers);
    
    // Import the b module to mock it
    const { b } = await import('../baml_client/async_client');
    
    // Mock the b.SplitPage to throw an error
    const mockSplitPage = vi.fn().mockRejectedValue(new Error('Test error'));
    b.SplitPage = mockSplitPage;
    
    await expect(parser.chunkInput(2)).rejects.toThrow('Chunking failed: Test error');
  });
});