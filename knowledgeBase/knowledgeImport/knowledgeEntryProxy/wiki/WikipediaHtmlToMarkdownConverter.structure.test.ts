import { WikipediaHtmlToMarkdownConverter } from './WikipediaHtmlToMarkdownConverter';
import { describe, it, expect } from 'vitest';

describe('WikipediaHtmlToMarkdownConverter - Structure Preservation', () => {
  let converter: WikipediaHtmlToMarkdownConverter;

  beforeEach(() => {
    converter = new WikipediaHtmlToMarkdownConverter();
  });

  it('should preserve the correct order of headings and content', () => {
    // 使用简化的HTML来测试大纲与文本的关联
    const html = `
    <html>
      <body>
        <div id="mw-content-text">
          <div class="mw-heading mw-heading2">
            <h2 id="Background">Background</h2>
          </div>
          <p>This is the background content.</p>
          
          <div class="mw-heading mw-heading2">
            <h2 id="Chart_performance">Chart performance</h2>
          </div>
          <p>This is the chart performance content.</p>
          
          <div class="mw-heading mw-heading2">
            <h2 id="Personnel">Personnel</h2>
          </div>
          <div class="mw-heading mw-heading3">
            <h3 id="Calendar">Calendar</h3>
          </div>
          <ul>
            <li>Member 1</li>
            <li>Member 2</li>
          </ul>
          
          <div class="mw-heading mw-heading2">
            <h2 id="Later_years">Later years</h2>
          </div>
          <p>This is the later years content.</p>
        </div>
      </body>
    </html>
    `;

    const result = converter.convert(html);

    // 验证大纲与文本的正确顺序
    expect(result).toContain('## Background');
    expect(result).toContain('This is the background content.');

    expect(result).toContain('## Chart performance');
    expect(result).toContain('This is the chart performance content.');

    expect(result).toContain('## Personnel');
    expect(result).toContain('### Calendar');
    expect(result).toContain('- Member 1');
    expect(result).toContain('- Member 2');

    expect(result).toContain('## Later years');
    expect(result).toContain('This is the later years content.');

    // 验证大纲和内容是交替出现的，而不是分离的
    // 检查大纲和内容的顺序是否正确
    const backgroundIndex = result.indexOf('## Background');
    const backgroundContentIndex = result.indexOf(
      'This is the background content.',
    );
    const chartPerfIndex = result.indexOf('## Chart performance');
    const chartPerfContentIndex = result.indexOf(
      'This is the chart performance content.',
    );
    const personnelIndex = result.indexOf('## Personnel');
    const calendarIndex = result.indexOf('### Calendar');
    const member1Index = result.indexOf('- Member 1');
    const laterYearsIndex = result.indexOf('## Later years');
    const laterYearsContentIndex = result.indexOf(
      'This is the later years content.',
    );

    // 验证顺序：标题 -> 内容 -> 下一个标题
    expect(backgroundIndex).toBeLessThan(backgroundContentIndex);
    expect(backgroundContentIndex).toBeLessThan(chartPerfIndex);
    expect(chartPerfIndex).toBeLessThan(chartPerfContentIndex);
    expect(chartPerfContentIndex).toBeLessThan(personnelIndex);
    expect(personnelIndex).toBeLessThan(calendarIndex);
    expect(calendarIndex).toBeLessThan(member1Index);
    expect(member1Index).toBeLessThan(laterYearsIndex);
    expect(laterYearsIndex).toBeLessThan(laterYearsContentIndex);
  });

  it('should handle complex Wikipedia structure correctly', () => {
    // 更复杂的测试，模拟真实的Wikipedia页面结构
    const html = `
    <html>
      <body>
        <div id="mw-content-text">
          <table class="infobox">
            <tr><th>Title</th><td>Test Article</td></tr>
            <tr><th>Author</th><td>Test Author</td></tr>
          </table>
          
          <p>"<b>Test Article</b>" is a sample article for testing.</p>
          
          <div class="mw-heading mw-heading2">
            <h2 id="Background">Background</h2>
          </div>
          <p>This is the background content with a <a href="/wiki/Link">link</a>.</p>
          
          <div class="mw-heading mw-heading2">
            <h2 id="Chart_performance">Chart performance</h2>
          </div>
          <p>This is the chart performance content.</p>
          
          <div class="references">
            <ol>
              <li>Reference 1</li>
              <li>Reference 2</li>
            </ol>
          </div>
        </div>
      </body>
    </html>
    `;

    const result = converter.convert(html);

    // 验证infobox在最前面
    expect(result).toContain(
      '```\nInfobox:\nTitle: Test Article\nAuthor: Test Author\n```',
    );

    // 验证初始段落（注意引号的处理）
    expect(result).toContain(
      '"**Test Article**" is a sample article for testing.',
    );

    // 验证大纲与内容的顺序
    expect(result).toMatch(/```[\s\S]*?## Background/);
    expect(result).toMatch(
      /## Background[\s\S]*?This is the background content/,
    );
    expect(result).toMatch(
      /This is the background content[\s\S]*?## Chart performance/,
    );
    expect(result).toMatch(
      /## Chart performance[\s\S]*?This is the chart performance content/,
    );
    expect(result).toMatch(
      /This is the chart performance content[\s\S]*?## References/,
    );
  });
});
