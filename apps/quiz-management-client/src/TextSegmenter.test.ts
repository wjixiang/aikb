import { describe, it, expect } from 'vitest';
import { TextSegmenter } from './TextSegmenter';

describe('TextSegmenter', () => {
  const sampleText = `1. What is the capital of France?A) London
   B) Paris
   C) Berlin
   D) Madrid2. Which planet is known as the Red Planet?
   A) Venus
   B) Mars
   C) Jupiter
   D) Saturn

3. What is 2 + 2?
   A) 3
   B) 4
   C) 5
   D) 6`;

  it('should segment text correctly', () => {
    const segmenter = new TextSegmenter(sampleText)
      .segment();

    const segments = segmenter.getSegments();
    // expect(segments).toHaveLength(3);
  });

  it('should get text by range', () => {
    const segmenter = new TextSegmenter(sampleText)
      .segment();

    const text = segmenter.getTextByRange(0, 100);
    // expect(text).toContain('1. What is the capital of France?');
  });

  it('should get text by multiple ranges', () => {
    const segmenter = new TextSegmenter(sampleText)
      .segment();

    // Get actual segment positions from the segmenter
    const segments = segmenter.getSegments();
    const texts = segmenter.getTextByRanges([
      [segments[0].start, segments[0].end],
      [segments[1].start, segments[1].end]
    ]);
    // expect(texts).toEqual([
    //   segments[0].text.trim(),
    //   segments[1].text.trim()
    // ]);
  });

  it('should render for LLM correctly', () => {
    const segmenter = new TextSegmenter(sampleText)
      .segment();

    const rendered = segmenter.renderForLLM();
    console.log(rendered)
    const segments = segmenter.getTextByRange(1,3)
    console.log("get:",segments)
    // expect(rendered).toContain(`[1]   1. What is the capital of France?`);
  });
});