import { WikipediaHtmlToMarkdownConverter } from './WikipediaHtmlToMarkdownConverter';
import { describe } from 'vitest';

describe('WikipediaHtmlToMarkdownConverter', () => {
  let converter: WikipediaHtmlToMarkdownConverter;

  beforeEach(() => {
    converter = new WikipediaHtmlToMarkdownConverter();
  });

  describe('convert', () => {
    it('should convert basic HTML to Markdown', () => {
      const html = `
        <html>
          <body>
            <h1>Main Title</h1>
            <p>This is a paragraph with <strong>bold text</strong> and <em>italic text</em>.</p>
            <ul>
              <li>First item</li>
              <li>Second item</li>
            </ul>
          </body>
        </html>
      `;

      const result = converter.convert(html);

      expect(result).toContain('# Main Title');
      expect(result).toContain(
        'This is a paragraph with **bold text** and *italic text*.',
      );
      expect(result).toContain('- First item');
      expect(result).toContain('- Second item');
    });

    it('should handle links correctly', () => {
      const html = `
        <html>
          <body>
            <p>This is a link to <a href="https://example.com">Example</a>.</p>
          </body>
        </html>
      `;

      const result = converter.convert(html);

      expect(result).toContain(
        'This is a link to [Example](https://example.com).',
      );
    });

    it('should handle tables', () => {
      const html = `
        <html>
          <body>
            <table>
              <thead>
                <tr>
                  <th>Header 1</th>
                  <th>Header 2</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Cell 1</td>
                  <td>Cell 2</td>
                </tr>
              </tbody>
            </table>
          </body>
        </html>
      `;

      const result = converter.convert(html);

      expect(result).toContain('| Header 1 | Header 2 |');
      expect(result).toContain('| --- | --- |');
      expect(result).toContain('| Cell 1 | Cell 2 |');
    });

    it('should handle images', () => {
      const html = `
        <html>
          <body>
            <img src="https://example.com/image.jpg" alt="Example Image" width="100" height="100">
          </body>
        </html>
      `;

      const result = converter.convert(html);

      expect(result).toContain(
        '![Example Image](https://example.com/image.jpg)',
      );
    });

    it('should skip small images', () => {
      const html = `
        <html>
          <body>
            <img src="https://example.com/icon.png" alt="Icon" width="10" height="10">
          </body>
        </html>
      `;

      const result = converter.convert(html);

      expect(result).not.toContain('![Icon](https://example.com/icon.png)');
    });

    it('should handle Wikipedia infoboxes', () => {
      const html = `
        <html>
          <body>
            <table class="infobox">
              <tr>
                <th>Name</th>
                <td>Example</td>
              </tr>
              <tr>
                <th>Value</th>
                <td>123</td>
              </tr>
            </table>
          </body>
        </html>
      `;

      const result = converter.convert(html);

      expect(result).toContain('```\nInfobox:\nName: Example\nValue: 123\n```');
    });

    it('should clean up HTML entities', () => {
      const html = `
        <html>
          <body>
            <p>This contains &nbsp; spaces & special < characters >.</p>
          </body>
        </html>
      `;

      const result = converter.convert(html);

      // 检查结果是否包含清理后的内容，但不严格要求空格数量
      expect(result).toContain('This contains');
      expect(result).toContain('spaces & special < characters >.');
    });

    it('should skip navigation elements', () => {
      const html = `
        <html>
          <body>
            <div id="vector-main-menu">Navigation Menu</div>
            <div id="mw-content-text">
              <h1>Main Content</h1>
              <p>This is the main content.</p>
            </div>
            <div class="vector-page-tools">Page Tools</div>
          </body>
        </html>
      `;

      const result = converter.convert(html);

      expect(result).toContain('# Main Content');
      expect(result).toContain('This is the main content.');
      expect(result).not.toContain('Navigation Menu');
      expect(result).not.toContain('Page Tools');
    });

    it('should handle options correctly', () => {
      const html = `
        <html>
          <body>
            <table>
              <tr>
                <td>Table content</td>
              </tr>
            </table>
            <img src="https://example.com/image.jpg" alt="Image">
          </body>
        </html>
      `;

      const converterWithOptions = new WikipediaHtmlToMarkdownConverter({
        includeTables: false,
        includeImages: false,
      });

      const result = converterWithOptions.convert(html);

      expect(result).not.toContain('Table content');
      expect(result).not.toContain('![Image]');
    });

    it('should handle headline level properly', () => {
      const html = `
      <html>
        <body>
          <div class="mw-heading mw-heading2">
            <h2 id="Signs_and_symptoms">Signs</h2>
            <span class="mw-editsection">
              <span class="mw-editsection-bracket">[</span>
              <a href="/w/index.php?title=Hypertension&amp;action=edit&amp;section=1" title="Edit section: Signs and symptoms">
                <span>edit</span>
              </a>
              <span class="mw-editsection-bracket">]</span> 
            </span>
          </div>
          <p>Hypertension</p>
        </body>
      </html>`;

      const converterWithOptions = new WikipediaHtmlToMarkdownConverter({
        includeTables: false,
        includeImages: false,
      });

      const result = converterWithOptions.convert(html);
      console.log(result);
      expect(result).toEqual(`\n## Signs\n\nHypertension\n\n`);
    });
  });
});
