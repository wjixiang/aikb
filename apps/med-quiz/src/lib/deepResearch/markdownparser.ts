/**
 * MarkdownParser - 将 Markdown 文本解析为结构化 JSON
 */
export class MarkdownParser {
  /**
   * 解析 Markdown 文本为 JSON 结构
   * @param markdown Markdown 文本
   * @returns 解析后的 JSON 结构
   */
  public parse(markdown: string): MarkdownDocument {
    try {
      // 导入 marked 库
      const marked = require('marked');

      // 移除每行开头的多余空格（修复缩进问题）
      const normalizedMarkdown = markdown
        .split('\n')
        .map((line) => line.trimStart())
        .join('\n');

      // 配置 marked 选项
      marked.setOptions({
        headerIds: false,
        mangle: false,
        gfm: true,
      });

      // 解析 Markdown 为 tokens
      const tokens = marked.lexer(normalizedMarkdown);

      // 调试输出
      console.log(
        'Parsed tokens:',
        JSON.stringify(tokens.slice(0, 2), null, 2),
      );

      // 将 tokens 转换为结构化文档
      return this.tokensToDocument(tokens);
    } catch (error) {
      console.error('Error parsing markdown:', error);
      return { title: '', sections: [] };
    }
  }

  /**
   * 将 marked tokens 转换为结构化文档
   * @param tokens marked 解析后的 tokens
   * @returns 结构化文档
   */
  private tokensToDocument(tokens: any[]): MarkdownDocument {
    const document: MarkdownDocument = {
      title: '',
      sections: [],
    };

    if (!tokens || tokens.length === 0) {
      return document;
    }

    // 查找文档标题（第一个 h1）
    const titleToken = tokens.find(
      (t) => t.type === 'heading' && t.depth === 1,
    );
    if (titleToken) {
      document.title = titleToken.text;
    }

    // 当前处理的部分
    let currentSection: Section | null = null;

    // 处理 tokens
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];

      if (token.type === 'heading') {
        if (token.depth === 1) {
          // 跳过文档标题，已经处理过了
          if (document.title === token.text) {
            continue;
          }

          // 创建新的顶级部分
          currentSection = this.createSection(token.text, 1);
          document.sections.push(currentSection);
        } else if (token.depth === 2) {
          // 创建新的部分
          currentSection = this.createSection(token.text, 1);
          document.sections.push(currentSection);
        } else if (token.depth >= 3) {
          // 创建子部分
          if (currentSection) {
            const subSection = this.createSection(token.text, 2);
            currentSection.subsections.push(subSection);

            // 更新当前部分为子部分
            currentSection = subSection;
          } else {
            // 如果没有当前部分，创建一个默认部分
            currentSection = this.createSection(token.text, 1);
            document.sections.push(currentSection);
          }
        }
      } else if (currentSection) {
        // 处理其他类型的内容
        const content = this.tokenToContent(token, tokens, i);
        if (content) {
          currentSection.content.push(content);

          // 如果处理了多个 token（如列表或表格），更新索引
          if (content.type === 'list' && token.items) {
            // 列表已经在 tokenToContent 中完全处理
          } else if (content.type === 'table' && token.header) {
            // 表格已经在 tokenToContent 中完全处理
          }
        }
      }
    }

    return document;
  }

  /**
   * 创建新的部分
   */
  private createSection(title: string, level: number): Section {
    return {
      title,
      level,
      content: [],
      subsections: [],
    };
  }

  /**
   * 将 token 转换为内容
   */
  private tokenToContent(
    token: any,
    tokens: any[],
    index: number,
  ): Content | null {
    switch (token.type) {
      case 'paragraph':
        return {
          type: 'text',
          text: token.text,
        };

      case 'list':
        const items = token.items.map((item: any) => ({
          text: item.text,
        }));

        return {
          type: 'list',
          items,
        };

      case 'code':
        return {
          type: 'code',
          language: token.lang || '',
          code: token.text,
        };

      case 'hr':
        return {
          type: 'hr',
        };

      case 'table':
        return {
          type: 'table',
          header: token.header,
          rows: token.rows,
        };

      case 'blockquote':
        return {
          type: 'text',
          text: token.text,
        };

      default:
        return null;
    }
  }

  /**
   * 将文档转换回 Markdown
   * @param document 文档结构
   * @returns Markdown 文本
   */
  public toMarkdown(document: MarkdownDocument): string {
    let markdown = '';

    // 添加标题
    if (document.title) {
      markdown += `# ${document.title}\n\n`;
    }

    // 添加各部分
    for (const section of document.sections) {
      markdown += this.sectionToMarkdown(section, 2);
    }

    return markdown;
  }

  /**
   * 将部分转换为 Markdown
   * @param section 部分
   * @param baseLevel 基础标题级别
   * @returns Markdown 文本
   */
  private sectionToMarkdown(section: Section, baseLevel: number): string {
    let markdown = '';

    // 添加标题
    const level = '#'.repeat(baseLevel);
    markdown += `${level} ${section.title}\n\n`;

    // 添加内容
    for (const item of section.content) {
      markdown += this.contentToMarkdown(item);
    }

    // 添加子部分
    for (const subsection of section.subsections) {
      markdown += this.sectionToMarkdown(subsection, baseLevel + 1);
    }

    return markdown;
  }

  /**
   * 将内容项转换为 Markdown
   * @param content 内容项
   * @returns Markdown 文本
   */
  private contentToMarkdown(content: Content): string {
    switch (content.type) {
      case 'text':
        return `${content.text}\n\n`;

      case 'heading':
        const level = '#'.repeat(content.level);
        return `${level} ${content.text}\n\n`;

      case 'list':
        let listText = '';
        for (const item of content.items) {
          listText += `- ${item.text}\n`;
        }
        return `${listText}\n`;

      case 'code':
        return `\`\`\`${content.language}\n${content.code}\n\`\`\`\n\n`;

      case 'hr':
        return `---\n\n`;

      case 'table':
        let tableText = '';

        // 表头
        tableText += `| ${content.header.join(' | ')} |\n`;

        // 分隔线
        tableText += `| ${content.header.map(() => '---').join(' | ')} |\n`;

        // 行
        for (const row of content.rows) {
          tableText += `| ${row.join(' | ')} |\n`;
        }

        return `${tableText}\n`;

      default:
        return '';
    }
  }
}

// 类型定义
export interface MarkdownDocument {
  title: string;
  sections: Section[];
}

export interface Section {
  title: string;
  level: number;
  content: Content[];
  subsections: Section[];
}

export type Content =
  | TextContent
  | HeadingContent
  | ListContent
  | CodeBlock
  | HorizontalRuleContent
  | TableContent;

export interface TextContent {
  type: 'text';
  text: string;
}

export interface HeadingContent {
  type: 'heading';
  text: string;
  level: number;
}

export interface ListContent {
  type: 'list';
  items: ListItem[];
}

export interface ListItem {
  text: string;
}

export interface CodeBlock {
  type: 'code';
  language: string;
  code: string;
}

export interface HorizontalRuleContent {
  type: 'hr';
}

export interface TableContent {
  type: 'table';
  header: string[];
  rows: string[][];
}
