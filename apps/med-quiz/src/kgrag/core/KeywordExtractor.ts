import Segmentit from "segmentit";
const segmenter = new Segmentit();

// Define a default list of English stopwords
const defaultStopwords = [
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "but",
  "by",
  "for",
  "if",
  "in",
  "into",
  "is",
  "it",
  "no",
  "not",
  "of",
  "on",
  "or",
  "such",
  "that",
  "the",
  "their",
  "then",
  "there",
  "these",
  "they",
  "this",
  "to",
  "was",
  "will",
  "with",
];

// Simple word tokenizer
function simpleWordTokenizer(text: string): string[] {
  return text.toLowerCase().match(/\b\w+\b/g) || [];
}

// Very basic Porter Stemmer (simplified for demonstration)
// For a full implementation, a dedicated library would be better.
function simplePorterStemmer(word: string): string {
  word = word.toLowerCase();
  // Remove 's'
  if (word.endsWith("s")) {
    word = word.slice(0, -1);
  }
  // Remove 'es'
  if (word.endsWith("es")) {
    word = word.slice(0, -2);
  }
  // Remove 'ed'
  if (word.endsWith("ed")) {
    word = word.slice(0, -2);
  }
  // Remove 'ing'
  if (word.endsWith("ing")) {
    word = word.slice(0, -3);
  }
  return word;
}

/**
 * Extract keyword from query by TF-IDF
 */
export class KeywordExtractor {
  private segmenter: Segmentit;
  private stemmer: (word: string) => string;

  constructor() {
    // Initialize Chinese text segmenter
    // eslint-disable-next-line react-hooks/rules-of-hooks
    this.segmenter = Segmentit.useDefault(new Segmentit());
    this.stemmer = simplePorterStemmer;
  }

  private tokenizeChinese(text: string): string[] {
    const segmented = this.segmenter.doSegment(text, {
      simple: true,
      stripPunctuation: true,
    }) as { w: string }[];
    return segmented
      .map((item) => item.w)
      .filter((word) => !/[.,!?;:()'"“”‘’【】《》<>{}[]]/.test(word));
  }

  /**
   * Extract keywords from text
   * @param text Input text to process
   * @param options Configuration options
   * @returns Array of extracted keywords
   */
  extractKeywords(
    text: string,
    options: {
      minLength?: number;
      maxLength?: number;
      stopwords?: string[];
      stem?: boolean;
    } = {},
  ): string[] {
    const {
      minLength = 2,
      maxLength = 20,
      stopwords = defaultStopwords,
      stem = true,
    } = options;

    // Tokenize text
    let tokens: string[] = [];
    // Handle Chinese text
    if (/[\u4e00-\u9fa5]/.test(text)) {
      tokens = this.tokenizeChinese(text);
    } else {
      // Fallback to simple tokenizer for non-Chinese
      tokens = simpleWordTokenizer(text);
    }

    // Filter tokens
    tokens = tokens
      .map((token: string) => token.toLowerCase())
      .filter((token: string) => {
        // Length check
        if (token.length < minLength || token.length > maxLength) return false;
        // Stopwords check
        if (stopwords.includes(token)) return false;
        return true;
      });

    // Stem tokens if enabled
    if (stem) {
      tokens = tokens.map((token: string) => this.stemmer(token));
    }

    return tokens;
  }

  /**
   * Get top N keywords by frequency
   * @param text Input text to process
   * @param topN Number of top keywords to return
   * @param options Configuration options
   * @returns Array of [keyword, frequency] tuples
   */
  getTopKeywords(
    text: string,
    topN: number = 10,
    options?: {
      minLength?: number;
      maxLength?: number;
      stopwords?: string[];
      stem?: boolean;
    },
  ): [string, number][] {
    const keywords = this.extractKeywords(text, options);
    const frequencyMap = new Map<string, number>();

    // Count keyword frequencies
    for (const keyword of keywords) {
      frequencyMap.set(keyword, (frequencyMap.get(keyword) || 0) + 1);
    }

    // Sort by frequency and return top N
    return Array.from(frequencyMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, topN);
  }
}
