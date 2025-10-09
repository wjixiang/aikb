import { h1Chunking, paragraphChunking, chunkText, ChunkResult } from './chunkingTool';

describe('Chunking Tool Tests', () => {
  describe('h1Chunking', () => {
    it('should chunk text based on H1 headings', () => {
      const markdown = `# Introduction
This is the introduction content.

# Chapter 1
This is the first chapter content.

# Chapter 2
This is the second chapter content.`;

      const result = h1Chunking(markdown);
      
      expect(result).toHaveLength(3);
      expect(result[0].title).toBe('Introduction');
      expect(result[0].content).toContain('# Introduction');
      expect(result[0].content).toContain('This is the introduction content.');
      expect(result[0].index).toBe(0);
      
      expect(result[1].title).toBe('Chapter 1');
      expect(result[1].content).toContain('# Chapter 1');
      expect(result[1].content).toContain('This is the first chapter content.');
      expect(result[1].index).toBe(1);
      
      expect(result[2].title).toBe('Chapter 2');
      expect(result[2].content).toContain('# Chapter 2');
      expect(result[2].content).toContain('This is the second chapter content.');
      expect(result[2].index).toBe(2);
    });

    it('should handle empty or null input', () => {
      expect(h1Chunking('')).toEqual([]);
      expect(h1Chunking(null as any)).toEqual([]);
      expect(h1Chunking(undefined as any)).toEqual([]);
    });

    it('should handle text without H1 headings', () => {
      const text = 'This is plain text without any H1 headings.';
      const result = h1Chunking(text);
      
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Untitled');
      expect(result[0].content).toBe(text);
      expect(result[0].index).toBe(0);
    });

    it('should handle complex H1 headings with special characters', () => {
      const markdown = `# Chapter 1: Getting Started
Content for chapter 1.

# Chapter 2 - Advanced Topics
Content for chapter 2.

# Appendix A: Reference
Reference content.`;

      const result = h1Chunking(markdown);
      
      expect(result).toHaveLength(3);
      expect(result[0].title).toBe('Chapter 1: Getting Started');
      expect(result[1].title).toBe('Chapter 2 - Advanced Topics');
      expect(result[2].title).toBe('Appendix A: Reference');
    });

    it('should preserve content structure within chunks', () => {
      const markdown = `# Introduction
This is the introduction.

## Subsection
This is a subsection.

- List item 1
- List item 2

# Conclusion
This is the conclusion.`;

      const result = h1Chunking(markdown);
      
      expect(result).toHaveLength(2);
      expect(result[0].content).toContain('## Subsection');
      expect(result[0].content).toContain('- List item 1');
      expect(result[1].content).toContain('This is the conclusion.');
    });
  });

  describe('paragraphChunking', () => {
    it('should split text into paragraphs', () => {
      const text = `This is paragraph 1.

This is paragraph 2.

This is paragraph 3.`;

      const result = paragraphChunking(text);
      
      expect(result).toHaveLength(3);
      expect(result[0]).toBe('This is paragraph 1.');
      expect(result[1]).toBe('This is paragraph 2.');
      expect(result[2]).toBe('This is paragraph 3.');
    });

    it('should handle empty or null input', () => {
      expect(paragraphChunking('')).toEqual([]);
      expect(paragraphChunking(null as any)).toEqual([]);
      expect(paragraphChunking(undefined as any)).toEqual([]);
    });

    it('should handle various line break patterns', () => {
      const text = `Paragraph 1.\n\nParagraph 2.\n\nParagraph 3.\r\n\r\nParagraph 4.`;
      const result = paragraphChunking(text);
      
      expect(result).toHaveLength(4);
      expect(result[0]).toBe('Paragraph 1.');
      expect(result[1]).toBe('Paragraph 2.');
      expect(result[2]).toBe('Paragraph 3.');
      expect(result[3]).toBe('Paragraph 4.');
    });

    it('should filter out empty paragraphs', () => {
      const text = `Paragraph 1.\n\n\n\nParagraph 2.\n\n   \nParagraph 3.`;
      const result = paragraphChunking(text);
      
      expect(result).toHaveLength(3);
      expect(result[0]).toBe('Paragraph 1.');
      expect(result[1]).toBe('Paragraph 2.');
      expect(result[2]).toBe('Paragraph 3.');
    });
  });

  describe('chunkText', () => {
    it('should use h1 strategy by default', () => {
      const markdown = `# Introduction
Intro content.

# Chapter 1
Chapter content.`;

      const result = chunkText(markdown) as ChunkResult[];
      
      expect(result).toHaveLength(2);
      expect(result[0].title).toBe('Introduction');
      expect(result[1].title).toBe('Chapter 1');
    });

    it('should use h1 strategy when specified', () => {
      const markdown = `# Introduction
Intro content.`;

      const result = chunkText(markdown, 'h1') as ChunkResult[];
      
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Introduction');
    });

    it('should use paragraph strategy when specified', () => {
      const text = `Paragraph 1.\n\nParagraph 2.`;

      const result = chunkText(text, 'paragraph') as string[];
      
      expect(result).toHaveLength(2);
      expect(result[0]).toBe('Paragraph 1.');
      expect(result[1]).toBe('Paragraph 2.');
    });

    it('should throw error for unsupported strategy', () => {
      expect(() => {
        chunkText('Some text', 'unsupported' as any);
      }).toThrow('Unsupported chunking strategy: unsupported');
    });
  });
});