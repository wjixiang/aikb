/**
 * Link extraction utilities for bidirectional link indexing
 * Handles [[title]] and [[title|alias]] formats
 */

export interface ExtractedLink {
  title: string;
  alias?: string;
  position: number;
  raw: string;
  context?: string;
}

export interface LinkContext {
  before: string;
  after: string;
}

export class LinkExtractor {
  private static readonly LINK_PATTERN = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
  private static readonly CONTEXT_LENGTH = 50;

  /**
   * Extract all links from content
   * @param content Document content to extract links from
   * @returns Array of extracted links with metadata
   */
  static extract(content: string): ExtractedLink[] {
    const links: ExtractedLink[] = [];
    let match;

    // Reset regex state
    this.LINK_PATTERN.lastIndex = 0;

    while ((match = this.LINK_PATTERN.exec(content)) !== null) {
      const title = match[1].trim();
      const alias = match[2]?.trim();
      const position = match.index;

      // Extract context around the link
      const context = this.extractContext(content, position, match[0].length);

      links.push({
        title,
        alias,
        position,
        raw: match[0],
        context: `${context.before}[[${title}${alias ? '|' + alias : ''}]]${context.after}`,
      });
    }

    return links;
  }

  /**
   * Extract surrounding context for a link
   * @param content Full document content
   * @param position Position of the link
   * @param length Length of the link
   * @returns Context object with before and after text
   */
  private static extractContext(
    content: string,
    position: number,
    length: number,
  ): LinkContext {
    const before = content
      .substring(Math.max(0, position - this.CONTEXT_LENGTH), position)
      .trim();

    const after = content
      .substring(
        position + length,
        Math.min(content.length, position + length + this.CONTEXT_LENGTH),
      )
      .trim();

    return { before, after };
  }

  /**
   * Validate if a link title is valid
   * @param title Link title to validate
   * @returns True if valid, false otherwise
   */
  static validateTitle(title: string): boolean {
    return title.length > 0 && title.length <= 200 && !title.includes('\n');
  }

  /**
   * Normalize link title for consistent matching
   * @param title Title to normalize
   * @returns Normalized title
   */
  static normalizeTitle(title: string): string {
    return title.trim().toLowerCase().replace(/\s+/g, ' ');
  }

  /**
   * Extract unique links from content
   * @param content Document content
   * @returns Array of unique normalized titles
   */
  static extractUniqueTitles(content: string): string[] {
    const links = this.extract(content);
    const uniqueTitles = new Set(
      links
        .map((link) => this.normalizeTitle(link.title))
        .filter((title) => this.validateTitle(title)),
    );
    return Array.from(uniqueTitles);
  }

  /**
   * Count total links in content
   * @param content Document content
   * @returns Total number of links found
   */
  static countLinks(content: string): number {
    const links = this.extract(content);
    return links.length;
  }

  /**
   * Check if content contains links to a specific title
   * @param content Document content
   * @param targetTitle Title to search for
   * @returns True if contains link to target title
   */
  static containsLinkTo(content: string, targetTitle: string): boolean {
    const links = this.extract(content);
    const normalizedTarget = this.normalizeTitle(targetTitle);

    return links.some(
      (link) => this.normalizeTitle(link.title) === normalizedTarget,
    );
  }
}
