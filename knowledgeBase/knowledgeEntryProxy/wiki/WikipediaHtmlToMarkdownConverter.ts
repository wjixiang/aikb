import * as cheerio from 'cheerio';
import {
  HtmlToMarkdownConverter,
  BaseMarkdownOptions,
} from 'knowledgeBase/knowledgeEntry/wiki/HtmlToMarkdownConverter';

export interface WikipediaMarkdownOptions extends BaseMarkdownOptions {
  includeReferences?: boolean;
  includeInfoboxes?: boolean;
  maxImageWidth?: number;
}

export class WikipediaHtmlToMarkdownConverter extends HtmlToMarkdownConverter {
  protected options: WikipediaMarkdownOptions;

  constructor(options: WikipediaMarkdownOptions = {}) {
    super(options);
    this.options = {
      includeImages: true,
      includeTables: true,
      includeReferences: true,
      includeInfoboxes: true,
      maxImageWidth: 400,
      cleanUp: true,
      ...options,
    };
  }

  /**
   * Removes unwanted elements such as navigation, footer, edit links, etc.
   */
  protected removeUnwantedElements($: cheerio.CheerioAPI): void {
    // Call parent class method to remove common unwanted elements
    super.removeUnwantedElements($);

    // Remove navigation menus
    $(
      '#vector-main-menu, #mw-navigation, .vector-header-container, .mw-footer-container',
    ).remove();

    // Remove edit links
    $('.mw-editsection, .mw-editsection-bracket').remove();

    // Remove page tools
    $('.vector-page-tools, .vector-page-toolbar').remove();

    // Remove table of contents
    $('#toc, .toc').remove();

    // Remove language selector
    $('#p-lang-btn, .vector-language-selector').remove();

    // Remove print footer
    $('.printfooter').remove();

    // Remove category links
    $('#catlinks').remove();

    // Remove hidden categories
    $('.mw-hidden-catlinks').remove();
  }

  /**
   * Extracts the main content area
   */
  protected extractMainContent($: cheerio.CheerioAPI): cheerio.Cheerio<any> {
    // Wikipedia's main content is in #bodyContent or #mw-content-text
    let mainContent = $('#mw-content-text');

    // If main content is not found, try other selectors
    if (mainContent.length === 0) {
      mainContent = $('#bodyContent');
    }
    if (mainContent.length === 0) {
      mainContent = $('#content');
    }
    if (mainContent.length === 0) {
      mainContent = $('body');
    }

    return mainContent;
  }

  /**
   * Processes a single element
   */
  protected processElement($: cheerio.CheerioAPI, elem: any): string {
    const $elem = $(elem);
    const tagName = elem.tagName.toLowerCase();

    switch (tagName) {
      case 'div':
        // Handle special div elements
        if (
          $elem.hasClass('infobox') ||
          $elem.hasClass('infobox_v2') ||
          $elem.hasClass('infobox_v3')
        ) {
          if (this.options.includeInfoboxes) {
            return this.convertInfoboxToMarkdown($, elem) + '\n\n';
          }
          return '';
        }
        if (
          $elem.hasClass('references') ||
          $elem.hasClass('reflist') ||
          $elem.hasClass('refbegin')
        ) {
          if (this.options.includeReferences) {
            return this.convertReferencesToMarkdown($, elem) + '\n\n';
          }
          return '';
        }
        // Recursively process div content
        return this.processChildren($, elem);

      case 'table':
        if (this.options.includeTables) {
          // Skip navigation tables and other non-content tables
          if (
            $elem.hasClass('navbox') ||
            $elem.hasClass('vertical-navbox') ||
            $elem.hasClass('metadata') ||
            $elem.hasClass('mbox-small')
          ) {
            return '';
          }
          // Check if it's an infobox table
          if (
            $elem.hasClass('infobox') ||
            $elem.hasClass('infobox_v2') ||
            $elem.hasClass('infobox_v3')
          ) {
            if (this.options.includeInfoboxes) {
              return this.convertInfoboxToMarkdown($, elem) + '\n\n';
            }
            return '';
          }
          return this.convertTableToMarkdown($, elem) + '\n\n';
        }
        return '';

      default:
        // For other elements, use the parent class processing method
        return super.processElement($, elem);
    }
  }

  /**
   * Processes link elements
   */
  protected processLinkElement($: cheerio.CheerioAPI, elem: any): string {
    const $elem = $(elem);
    const href = $elem.attr('href');
    const linkText = $elem.text().trim();

    if (href && linkText) {
      // Skip internal links and edit links
      if (!href.startsWith('#') && !href.includes('action=edit')) {
        return `[${linkText}](${href})`;
      } else {
        return linkText;
      }
    } else {
      return $elem.text();
    }
  }

  /**
   * Converts images to Markdown
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
      fullSrc = 'https://en.wikipedia.org' + src;
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
   */
  protected getBaseUrl(): string {
    return 'https://en.wikipedia.org';
  }

  /**
   * Converts infobox to Markdown
   */
  private convertInfoboxToMarkdown(
    $: cheerio.CheerioAPI,
    infobox: any,
  ): string {
    let markdown = '```\n';
    markdown += 'Infobox:\n';

    const $infobox = $(infobox);
    $infobox.find('tr').each((i, row) => {
      const $row = $(row);
      const $th = $row.find('th').first();
      const $td = $row.find('td').first();

      if ($th.length && $td.length) {
        const key = $th.text().trim();
        const value = this.processInlineElements($, $td[0]).trim();
        markdown += `${key}: ${value}\n`;
      } else if ($th.length) {
        const title = $th.text().trim();
        if (title) {
          markdown += `# ${title}\n`;
        }
      }
    });

    markdown += '```\n';
    return markdown;
  }

  /**
   * Converts references to Markdown
   */
  private convertReferencesToMarkdown(
    $: cheerio.CheerioAPI,
    refs: any,
  ): string {
    let markdown = '## References\n\n';

    const $refs = $(refs);
    $refs.find('li').each((i, li) => {
      const text = this.processInlineElements($, li).trim();
      markdown += `${i + 1}. ${text}\n`;
    });

    return markdown;
  }
}
