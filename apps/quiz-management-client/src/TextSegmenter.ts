
export class TextSegmenter {
  text: string;
  segments!: {text: string, start: number, end: number}[];
  regexp = /([。？！\n]|^[A-Z]\)|\d+\.)/g

  constructor(text: string) {
    this.text = text;
    this.segment();
  }

  /**
   * Split text into segments based on delimiters
   * @param delimiters Regex pattern for split points (e.g. /([。？！\n]\s*)/g)
   */
  segment(delimiters: RegExp = /([。？！\n]|^[A-Z]\)|\d+\.)/g): this {
    const segments: {text: string, start: number, end: number}[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = delimiters.exec(this.text)) !== null) {
      const start = lastIndex;
      const end = match.index + match[0].length;
      segments.push({
        text: this.text.substring(start, end),
        start,
        end
      });
      lastIndex = end;
    }

    // Add final segment if text continues after last delimiter
    if (lastIndex < this.text.length) {
      segments.push({
        text: this.text.substring(lastIndex),
        start: lastIndex,
        end: this.text.length
      });
    }

    this.segments = segments;
    return this;
  }

  /**
   * Get all segments with their positions
   */
  getSegments(): {text: string, start: number, end: number}[] {
    return this.segments;
  }

  /**
   * Get text for a specific range
   * @param start Start position (inclusive)
   * @param end End position (exclusive)
   */
  getTextByRange(start: number, end: number): string {
    return this.segments.slice(start-1 >=0 ? start-1 : 0,end).map(e=>e.text).join(" ")
  }

  /**
   * Get text for multiple ranges
   * @param ranges Array of [start, end] tuples
   */
  getTextByRanges(ranges: [number, number][]): string[] {
    return ranges.map(([start, end]) => this.getTextByRange(start, end));
  }

  /**
   * Render segments with numbered markers for LLM processing
   */
  renderForLLM(): string {
    return this.segments.map((seg, i) => {
      const index = i + 1; // Start numbering from 1
      const marker = `[${index}]`.padEnd(6); // Fixed width for alignment
      return `${marker}${seg.text.trim()}`;
    }).join('\n');
  }

  /**
   * split origin text into smaller chunk to reduce LLM workload
   */
  // async split(text: string): Promise<string> {
  //   const parsed_text = new TextSegmenter(text).renderForLLM()
  //   const chunk_index = await b.SplitPage(parsed_text,3)
  // }
}