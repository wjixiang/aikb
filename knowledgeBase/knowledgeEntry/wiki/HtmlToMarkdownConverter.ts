import * as cheerio from 'cheerio';

export interface BaseMarkdownOptions {
  includeImages?: boolean;
  includeTables?: boolean;
  cleanUp?: boolean;
}

export abstract class HtmlToMarkdownConverter {
  protected options: BaseMarkdownOptions;

  constructor(options: BaseMarkdownOptions = {}) {
    this.options = {
      includeImages: true,
      includeTables: true,
      cleanUp: true,
      ...options,
    };
  }

  /**
   * Converts HTML to Markdown
   * @param html The HTML string
   * @returns The converted Markdown text
   */
  convert(html: string): string {
    const $ = cheerio.load(html);

    // Remove unwanted elements
    this.removeUnwantedElements($);

    // Extract main content
    const content = this.extractMainContent($);

    // Convert to Markdown
    let markdown = this.convertToMarkdown($, content);

    // Clean up and format
    if (this.options.cleanUp) {
      markdown = this.cleanUpMarkdown(markdown);
    }

    return markdown;
  }

  /**
   * Removes unwanted elements such as navigation, footer, etc.
   * Subclasses can override this method to implement element removal for specific websites
   */
  protected removeUnwantedElements($: cheerio.CheerioAPI): void {
    // Remove scripts and styles
    $('script, style, noscript').remove();

    // Remove comments
    $('*')
      .contents()
      .filter(function () {
        return this.type === 'comment';
      })
      .remove();
  }

  /**
   * Extracts the main content area
   * Subclasses should override this method to implement content extraction for specific websites
   */
  protected abstract extractMainContent(
    $: cheerio.CheerioAPI,
  ): cheerio.Cheerio<any>;

  /**
   * Converts HTML content to Markdown
   */
  protected convertToMarkdown(
    $: cheerio.CheerioAPI,
    content: cheerio.Cheerio<any>,
  ): string {
    // Process all child elements
    return this.processChildren($, content[0]);
  }

  /**
   * Processes all child elements of an element
   */
  protected processChildren($: cheerio.CheerioAPI, elem: any): string {
    let markdown = '';

    $(elem)
      .contents()
      .each((i, child) => {
        if (child.type === 'text') {
          // Handle text nodes
          const text = child.data.trim();
          if (text) {
            markdown += text + ' ';
          }
        } else if (child.type === 'tag') {
          // Handle element nodes
          markdown += this.processElement($, child);
        }
      });

    return markdown;
  }

  /**
   * Processes a single element
   * Subclasses can override this method to handle specific element types
   */
  protected processElement($: cheerio.CheerioAPI, elem: any): string {
    const $elem = $(elem);
    const tagName = elem.tagName.toLowerCase();

    switch (tagName) {
      case 'h1':
      case 'h2':
      case 'h3':
      case 'h4':
      case 'h5':
      case 'h6':
        return this.convertHeadingToMarkdown($, elem);

      case 'p':
        const pText = this.processInlineElements($, elem).trim();
        return pText ? pText + '\n\n' : '';

      case 'ul':
      case 'ol':
        return this.convertListToMarkdown($, elem);

      case 'table':
        if (this.options.includeTables) {
          return this.convertTableToMarkdown($, elem) + '\n\n';
        }
        return '';

      case 'img':
        if (this.options.includeImages) {
          return this.convertImageToMarkdown($, elem) + '\n';
        }
        return '';

      case 'div':
        // Recursively process div content by default
        return this.processChildren($, elem);

      default:
        // For other elements, recursively process their child elements
        return this.processChildren($, elem);
    }
  }

  /**
   * Converts headings to Markdown
   */
  protected convertHeadingToMarkdown($: cheerio.CheerioAPI, elem: any): string {
    const level = parseInt(elem.tagName.substring(1));
    const text = $(elem).text().trim();
    return text ? '\n' + '#'.repeat(level) + ' ' + text + '\n\n' : '';
  }

  /**
   * Converts lists to Markdown
   */
  protected convertListToMarkdown($: cheerio.CheerioAPI, list: any): string {
    let markdown = '';
    const isOrdered = list.tagName === 'OL';

    $(list)
      .children('li')
      .each((j, li) => {
        const text = this.processInlineElements($, li).trim();
        const prefix = isOrdered ? `${j + 1}.` : '-';
        markdown += `${prefix} ${text}\n`;
      });

    return markdown + '\n';
  }

  /**
   * Processes inline elements (links, emphasis, code, etc.)
   */
  protected processInlineElements($: cheerio.CheerioAPI, elem: any): string {
    let text = '';

    $(elem)
      .contents()
      .each((i, content) => {
        if (content.type === 'text') {
          text += content.data;
        } else if (content.type === 'tag') {
          const $content = $(content);
          const tagName = content.tagName.toLowerCase();

          switch (tagName) {
            case 'a':
              text += this.processLinkElement($, content);
              break;

            case 'strong':
            case 'b':
              text += `**${$content.text()}**`;
              break;

            case 'em':
            case 'i':
              text += `*${$content.text()}*`;
              break;

            case 'code':
              text += `\`${$content.text()}\``;
              break;

            case 'sup':
              text += `^${$content.text()}^`;
              break;

            case 'sub':
              text += `~${$content.text()}~`;
              break;

            case 'br':
              text += '\n';
              break;

            default:
              // Recursively process other elements
              text += this.processInlineElements($, content);
          }
        }
      });

    return text;
  }

  /**
   * Processes link elements
   * Subclasses can override this method to implement specific link processing logic
   */
  protected processLinkElement($: cheerio.CheerioAPI, elem: any): string {
    const $elem = $(elem);
    const href = $elem.attr('href');
    const linkText = $elem.text().trim();

    if (href && linkText) {
      // Skip internal links by default
      if (!href.startsWith('#')) {
        return `[${linkText}](${href})`;
      } else {
        return linkText;
      }
    } else {
      return $elem.text();
    }
  }

  /**
   * Converts tables to Markdown
   */
  protected convertTableToMarkdown($: cheerio.CheerioAPI, table: any): string {
    let markdown = '';
    const $table = $(table);

    // Process table header
    $table.find('thead tr').each((i, row) => {
      let headerRow = '';

      $(row)
        .find('th')
        .each((j, cell) => {
          headerRow += `| ${this.processInlineElements($, cell).trim()} `;
        });

      if (headerRow) {
        markdown += headerRow + '|\n';

        // Add header separator line
        $(row)
          .find('th')
          .each((j, cell) => {
            markdown += '| --- ';
          });
        markdown += '|\n';
      }
    });

    // Process table body
    $table.find('tbody tr').each((i, row) => {
      let bodyRow = '';

      $(row)
        .find('td')
        .each((j, cell) => {
          bodyRow += `| ${this.processInlineElements($, cell).trim()} `;
        });

      if (bodyRow) {
        markdown += bodyRow + '|\n';
      }
    });

    return markdown;
  }

  /**
   * Converts images to Markdown
   * Subclasses can override this method to implement specific image processing logic
   */
  protected convertImageToMarkdown($: cheerio.CheerioAPI, img: any): string {
    const $img = $(img);
    const src = $img.attr('src');
    const alt = $img.attr('alt') || '';
    const width = $img.attr('width');
    const height = $img.attr('height');

    if (!src) {
      return '';
    }

    // Skip small icons and decorative images
    if (width && parseInt(width) < 20) {
      return '';
    }

    // Handle relative URLs
    let fullSrc = src;
    if (src.startsWith('//')) {
      fullSrc = 'https:' + src;
    } else if (src.startsWith('/')) {
      // Subclasses should override this method to provide the correct base URL
      fullSrc = this.getBaseUrl() + src;
    }

    let markdown = `![${alt}](${fullSrc})`;

    // Add size information (if available)
    if (width && height) {
      markdown += ` ${width}x${height}`;
    }

    return markdown;
  }

  /**
   * Gets the base URL
   * Subclasses should override this method to provide the correct base URL
   */
  protected getBaseUrl(): string {
    return '';
  }

  /**
   * Cleans up and formats Markdown text
   */
  protected cleanUpMarkdown(markdown: string): string {
    // Fix special characters
    markdown = markdown.replace(/&nbsp;/g, ' ');
    markdown = markdown.replace(/&/g, '&');
    markdown = markdown.replace(/</g, '<');
    markdown = markdown.replace(/>/g, '>');
    markdown = markdown.replace(/"/g, '"');

    // Remove excessive blank lines
    markdown = markdown.replace(/\n{3,}/g, '\n\n');

    // Remove leading and trailing whitespace from lines
    markdown = markdown
      .split('\n')
      .map((line) => line.trim())
      .join('\n');

    // Remove excessive spaces
    markdown = markdown.replace(/ {2,}/g, ' ');

    // Ensure document ends with a newline
    if (!markdown.endsWith('\n')) {
      markdown += '\n';
    }

    return markdown;
  }
}
