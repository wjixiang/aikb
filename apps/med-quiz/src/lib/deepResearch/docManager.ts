import { StructuredOutputParser } from '@langchain/core/output_parsers';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { RunnableSequence } from '@langchain/core/runnables';
import { ChatOpenAI } from '@langchain/openai';
import { z } from 'zod';
import { MarkdownParser } from './markdownparser';

interface OutlineItem {
  title: string;
  level: number;
  content?: string;
  children: OutlineItem[];
}

/**
 * 实现对传入文本的大纲结构分析，并转换为严格的 JSON 格式
 */
export default class docManager {
  rawDoc: string;
  summerizeModal: ChatOpenAI;
  workModal: ChatOpenAI;
  maxDepth: number = 3;
  includeContent: boolean = true; // 是否包括具体内容
  markdownParser: any;

  /**
   * @param rawDoc 原始文本
   * @param summerizeModal 文本分析模型，对分析能力要求高
   * @param workModal 处理数据转换模型，对分析能力要求低
   */
  constructor(
    rawDoc: string,
    summerizeModal: ChatOpenAI,
    workModal: ChatOpenAI,
  ) {
    this.rawDoc = rawDoc;
    this.summerizeModal = summerizeModal;
    this.workModal = workModal;
    this.markdownParser = new MarkdownParser();
  }

  /**
   * 清洗返回的 JSON 字符串，移除 ``` 或 ```json 块标记
   * @param input 原始输入，可能不是字符串
   * @returns 清洗后的字符串
   */
  async cleanJsonBlock(input: any): Promise<string> {
    // 如果输入不是字符串，尝试提取 content 字段或转换为字符串
    let text: string;
    if (typeof input !== 'string') {
      if (input && typeof input.content === 'string') {
        text = input.content;
      } else {
        text = String(input);
      }
    } else {
      text = input;
    }

    let cleaned = text.trim();
    // 如果输出文本以 ``` 开头和结尾，则去除这些标记
    if (cleaned.startsWith('```') && cleaned.endsWith('```')) {
      cleaned = cleaned.slice(3, -3).trim();
      // 如果开头含有 "json"，则去除（不区分大小写）
      if (cleaned.match(/^json/i)) {
        cleaned = cleaned.replace(/^json/i, '').trim();
      }
    }

    if (cleaned.startsWith(`"`) && cleaned.endsWith(`"`)) {
      cleaned = cleaned.slice(1, -1).trim();
    }

    return cleaned;
  }

  /**
   * 第一步：从原始文档提取大纲结构
   * @returns 结构化的大纲文本
   */
  async extractOutline(): Promise<string> {
    // 构造提示模板，用于提取大纲
    const outlineExtractionPrompt = ChatPromptTemplate.fromTemplate(`
      你是一个专业的文档结构分析工具。请分析以下文本，识别其大纲结构。
      
      规则如下：
      1. 识别层级关系，通常由标题前的符号（如#, ##, -）或数字（如1., 1.1, I, A）表示。
      2. 分析每个标题下的内容，提取关键信息。
      3. 最大允许的嵌套深度为 {maxDepth}。
      4. ${this.includeContent ? '包含' : '不包含'}每个部分的详细内容。
      5. 对于缺乏明确结构的文本，识别主题和小节，创建合理的层次结构。
      
      请输出一个结构化的大纲，使用缩进和符号（如#, ##, -）清晰地表示层级关系。
      
      文本内容:
      \`\`\`
      {input}
      \`\`\`
      
      结构化大纲：
      \`\`\`markdown
      {ouput}
      \`\`\`
    `);

    // 创建大纲提取链
    const outlineExtractionChain = RunnableSequence.from([
      outlineExtractionPrompt,
      this.summerizeModal,
    ]);

    try {
      // 调用链获取大纲
      const result = await outlineExtractionChain.invoke({
        input: this.rawDoc,
        maxDepth: this.maxDepth,
        ouput: undefined,
      });

      // 提取结果内容
      let outlineText = typeof result === 'string' ? result : result.content;
      console.log('提取的大纲:', outlineText);

      return outlineText.toString();
    } catch (error) {
      console.error('提取大纲结构时出错:', error);
      throw new Error(`提取大纲失败: ${error}`);
    }
  }

  /**
   * 第二步：将结构化大纲转换为 JSON 格式
   * @param outlineText 结构化的大纲文本
   * @returns JSON 格式的大纲结构
   */
  async convertToJson(outlineText: string) {
    // 定义递归的大纲项目结构

    // 定义输出结构
    interface OutlineOutput {
      outline: OutlineItem[];
    }

    // 定义递归 Zod 模式
    const outlineItemSchema: z.ZodType<OutlineItem> = z.lazy(() =>
      z.object({
        title: z.string().describe('标题或章节名称'),
        level: z.number().describe('层级深度，从1开始'),
        content: z.string().optional().describe('该部分的内容描述'),
        children: z.array(outlineItemSchema).describe('子项目列表'),
      }),
    );

    const outlineSchema: z.ZodType<OutlineOutput> = z.object({
      outline: z.array(outlineItemSchema).describe('大纲结构的根级项目列表'),
    });

    // 创建输出解析器
    const parser = StructuredOutputParser.fromZodSchema(outlineSchema);

    // 构造提示模板，用于转换大纲为JSON
    const jsonConversionPrompt = ChatPromptTemplate.fromTemplate(`
      你是一个专业的大纲转换工具。请将以下内容依据markdown大纲等级转换为严格的 JSON 格式, 最大深度为${this.maxDepth}
      
      JSON 格式必须满足:
      1. 每个项目包含 title(标题)、level(层级数字)、content(内容，可选)和children(子项目数组)。
      2. level 从 1 开始，表示层级深度。
      3. 最终 JSON 必须包含 "outline" 键，其值为大纲项目的数组。
      
      大纲内容:
      \`\`\`
      {outline}
      \`\`\`
      
      请输出严格的 JSON 格式，不包含任何额外文字、解释或标记。JSON 结构必须是:
      {{
        "outline": [
          {{
            "title": "标题1",
            "level": 1,
            "content": "内容描述",
            "children": [ ... ]
          }},
          ...
        ]
      }}
    `);

    // 创建 JSON 转换链
    const jsonConversionChain = RunnableSequence.from([
      jsonConversionPrompt,
      this.workModal,
      (out: any) => this.cleanJsonBlock(out),
    ]);

    try {
      // 调用链获取 JSON 字符串
      const jsonString = await jsonConversionChain.invoke({
        outline: outlineText,
      });

      // 解析 JSON 字符串
      try {
        const jsonResult = JSON.parse(jsonString);
        // 验证结果必须包含 outline 字段
        if (!jsonResult.outline || !Array.isArray(jsonResult.outline)) {
          // 如果没有 outline 字段，进行修复
          return {
            outline: Array.isArray(jsonResult) ? jsonResult : [jsonResult],
          };
        }
        return jsonResult;
      } catch (parseError) {
        console.error('JSON 解析失败:', parseError);
        console.log('原始 JSON 字符串:', jsonString);
        throw new Error(`JSON 解析失败: ${parseError}`);
      }
    } catch (error) {
      console.error('转换大纲为 JSON 时出错:', error);
      throw error;
    }
  }

  /**
   * 完整的处理流程：先提取大纲，再转换为 JSON
   */
  async outlineToJson() {
    try {
      // 第一步：提取大纲
      const outlineText = await this.extractOutline();

      // 第二步：转换为 JSON
      const jsonResult = await this.convertToJson(outlineText);

      return jsonResult;
    } catch (error) {
      console.error('文档处理时出错:', error);
      throw error;
    }
  }

  /**
   * 将大纲结构转换为 Markdown 格式文本
   * @param items 大纲项目数组或包含outline属性的对象
   * @param startLevel 起始级别，指定从哪个级别开始作为 Markdown 的一级标题，默认为1
   * @param options 额外选项，如是否包含代码块等
   * @returns Markdown 格式的文本
   */
  treeToMarkdown(
    items: OutlineItem[] | { outline: OutlineItem[] },
    startLevel: number = 1,
    options: { includeCode?: boolean } = { includeCode: false },
  ): string {
    // 提取大纲项目数组
    let outlineItems: OutlineItem[];
    if (Array.isArray(items)) {
      outlineItems = items;
    } else if (
      items &&
      typeof items === 'object' &&
      'outline' in items &&
      Array.isArray(items.outline)
    ) {
      outlineItems = items.outline;
    } else {
      console.warn('传入的不是有效的大纲结构，尝试转换');
      outlineItems = [items as any];
    }

    // 过滤掉明显不是大纲项的内容
    // 比如检测是否包含大量代码或非结构化内容
    const isCodeBlock = (text: string): boolean => {
      // 检测明显的代码特征
      const codePatterns = [
        /import\s+[\w\s{},*]+\s+from\s+["'][^"']+["']/, // import 语句
        /export\s+(default\s+)?(class|function|const|interface)/, // export 语句
        /class\s+\w+\s*{/, // 类定义
        /function\s+\w+\s*\([\w\s,]*\)\s*{/, // 函数定义
        /const\s+\w+\s*=\s*[\w\s(){}=>]+/, // 常量定义
        /interface\s+\w+\s*{/, // 接口定义
      ];

      return codePatterns.some((pattern) => pattern.test(text));
    };

    // 递归处理单个大纲项
    const processItem = (item: OutlineItem): string => {
      if (!item || (!item.title && !item.content)) return '';

      let markdown = '';

      // 检查内容是否为代码块，如果是且不包含代码块选项为false，则跳过或特殊处理
      if (item.content && isCodeBlock(item.content) && !options.includeCode) {
        // 可以选择完全跳过，或按内容处理而非大纲项
        return '';
      }

      // 计算标题级别，考虑起始级别的偏移
      if (item.level < startLevel) {
        // 仅处理子项目
        const children = item.children || [];
        for (const child of children) {
          markdown += processItem(child);
        }
        return markdown;
      }

      // 调整后的级别 = 项目实际级别 - 起始级别 + 1
      const adjustedLevel = Math.min(item.level - startLevel + 1, 6);
      const headingPrefix = '#'.repeat(adjustedLevel);

      // 添加标题 (确保标题不是代码片段)
      if (item.title && !isCodeBlock(item.title)) {
        markdown += `${headingPrefix} ${item.title.trim()}\n\n`;
      }

      // 添加内容 (如果有且不是代码片段)
      if (item.content && !isCodeBlock(item.content)) {
        // 对内容进行处理，避免将普通段落误识别为结构化内容
        markdown += `${item.content.trim()}\n\n`;
      }

      // 递归处理子项目
      const children = item.children || [];
      for (const child of children) {
        markdown += processItem(child);
      }

      return markdown;
    };

    // 处理所有顶级项目，过滤掉空结果
    let result = '';
    for (const item of outlineItems) {
      const itemResult = processItem(item);
      if (itemResult.trim()) {
        result += itemResult;
      }
    }

    return result.trim();
  }

  /**
   * 将原始文档转换为Markdown格式文本
   * 完整流程：提取大纲 -> 转为JSON -> 转为Markdown
   */
  async docToMarkdown(titleInContent: boolean = false): Promise<string> {
    try {
      // 获取JSON格式的大纲结构
      const outlineJson = await this.outlineToJson();
      console.log(JSON.stringify(outlineJson));
      // 将大纲结构转换为Markdown
      const markdown = this.treeToMarkdown(
        outlineJson.outline,
        titleInContent ? 1 : 2,
      );

      return markdown;
    } catch (error) {
      console.error('转换文档为Markdown时出错:', error);
      throw error;
    }
  }

  /**
   * 使用 MarkdownParser 将 Markdown 解析为 JSON 结构
   * @param markdownText 从 extractOutline 获取的 Markdown 文本
   * @returns 解析后的 JSON 结构
   */
  async parseMarkdownWithParser(markdownText: string): Promise<any> {
    try {
      // 使用 MarkdownParser 解析 Markdown
      const result = this.markdownParser.parse(markdownText);

      // 如果解析结果为空，尝试使用备用方法
      if (!result.outline || result.outline.length === 0) {
        console.warn('MarkdownParser 解析结果为空，尝试使用备用方法');
        return await this.convertToJson(markdownText);
      }

      return result;
    } catch (error) {
      console.error('使用 MarkdownParser 解析 Markdown 时出错:', error);
      // 出错时尝试使用备用方法
      console.warn('尝试使用备用方法解析');
      return await this.convertToJson(markdownText);
    }
  }

  /**
   * 完整流程：提取大纲结构并用 MarkdownParser 解析为 JSON
   * @returns 由 MarkdownParser 解析出的 JSON 格式大纲结构
   */
  async outlineToJsonWithParser(): Promise<any> {
    try {
      // 先提取大纲
      const outlineText = await this.extractOutline();

      // 使用 MarkdownParser 解析为 JSON
      return await this.parseMarkdownWithParser(outlineText);
    } catch (error) {
      console.error('使用 MarkdownParser 解析大纲时出错:', error);
      throw error;
    }
  }

  /**
   * 直接解析原始文档为 JSON 结构
   * 不依赖 AI 提取大纲，直接使用 MarkdownParser 解析
   * @returns JSON 格式的大纲结构
   */
  parseRawDocToJson(): any {
    try {
      // 直接使用 MarkdownParser 解析原始文档
      return this.markdownParser.parse(this.rawDoc);
    } catch (error) {
      console.error('直接解析原始文档时出错:', error);
      throw new Error(`直接解析失败: ${error}`);
    }
  }

  /**
   * 使用 remark 将 Markdown 解析为 JSON 结构 (保留原有方法作为备用)
   * @param markdownText 从 extractOutline 获取的 Markdown 文本
   * @returns 解析后的 JSON 结构
   */
  async parseMarkdownWithRemark(markdownText: string): Promise<any> {
    try {
      // 首先尝试使用 MarkdownParser
      return await this.parseMarkdownWithParser(markdownText);
    } catch (error) {
      console.error('使用 MarkdownParser 解析失败，尝试使用 remark:', error);

      try {
        // 作为备用，使用原有的 remark 方法
        // 首先导入必要的依赖
        const { unified } = await import('unified');
        const remarkParse = await import('remark-parse');
        const remarkGfm = await import('remark-gfm');

        // 创建处理器
        const processor = unified()
          .use(remarkParse.default)
          .use(remarkGfm.default);

        // 解析 Markdown
        const ast = await processor.parse(markdownText);
        const result = await processor.run(ast);

        // 转换 AST 为更易读的大纲结构
        const outline = this.convertAstToOutlineStructure(result);

        return { outline };
      } catch (remarkError) {
        console.error('使用 remark 解析 Markdown 时出错:', remarkError);
        throw new Error(`解析失败: ${remarkError}`);
      }
    }
  }

  /**
   * 将 remark 的 AST 转换为与类中使用的大纲结构兼容的格式 (保留原有方法)
   * @param ast remark 解析生成的 AST
   * @returns 大纲结构
   */
  private convertAstToOutlineStructure(ast: any): OutlineItem[] {
    // 保留原有实现...
    const outlineItems: OutlineItem[] = [];
    const headingStack: OutlineItem[][] = [outlineItems];
    let currentLevel = 0;
    let currentContentBuffer = '';

    // 遍历 AST 节点
    const visit = (node: any) => {
      if (node.type === 'heading') {
        // 如果有待处理的内容，添加到前一个标题
        if (currentContentBuffer && headingStack[currentLevel].length > 0) {
          const lastItem =
            headingStack[currentLevel][headingStack[currentLevel].length - 1];
          lastItem.content =
            (lastItem.content || '') + currentContentBuffer.trim();
          currentContentBuffer = '';
        }

        // 获取标题文本
        let headingText = '';
        if (node.children) {
          for (const child of node.children) {
            if (child.type === 'text') {
              headingText += child.value;
            }
          }
        }

        const level = node.depth;

        // 调整堆栈深度以匹配当前标题级别
        while (currentLevel >= level) {
          headingStack.pop();
          currentLevel--;
        }

        // 创建新的大纲项目
        const newItem: OutlineItem = {
          title: headingText.trim(),
          level: level,
          children: [],
        };

        // 添加到当前级别的堆栈
        headingStack[currentLevel].push(newItem);

        // 为子节点创建新级别
        headingStack.push(newItem.children);
        currentLevel = level;
      }
      // 处理段落和其他内容节点
      else if (
        node.type === 'paragraph' ||
        node.type === 'blockquote' ||
        node.type === 'list'
      ) {
        let contentText = '';
        const extractText = (n: any): string => {
          if (n.type === 'text') return n.value;
          if (!n.children) return '';
          return n.children.map(extractText).join('');
        };

        contentText = extractText(node);

        if (contentText.trim()) {
          currentContentBuffer += contentText.trim() + '\n\n';
        }
      }

      // 递归处理子节点
      if (node.children) {
        for (const child of node.children) {
          visit(child);
        }
      }
    };

    // 开始遍历
    for (const child of ast.children) {
      visit(child);
    }

    // 处理最后一个内容缓冲区
    if (currentContentBuffer && headingStack[currentLevel].length > 0) {
      const lastItem =
        headingStack[currentLevel][headingStack[currentLevel].length - 1];
      lastItem.content = (lastItem.content || '') + currentContentBuffer.trim();
    }

    return outlineItems;
  }

  /**
   * 完整流程：提取大纲结构并解析为 JSON
   * 优先使用 MarkdownParser，失败时回退到 remark
   * @returns JSON 格式大纲结构
   */
  async outlineToJsonWithRemark(): Promise<any> {
    try {
      // 先提取大纲
      const outlineText = await this.extractOutline();

      // 优先使用 MarkdownParser 解析
      return await this.parseMarkdownWithParser(outlineText);
    } catch (error) {
      console.error(
        '使用 MarkdownParser 解析大纲时出错，尝试使用 remark:',
        error,
      );

      // 提取大纲
      const outlineText = await this.extractOutline();

      // 使用原有的 remark 方法作为备用
      try {
        const { unified } = await import('unified');
        const remarkParse = await import('remark-parse');
        const remarkGfm = await import('remark-gfm');

        // 创建处理器
        const processor = unified()
          .use(remarkParse.default)
          .use(remarkGfm.default);

        // 解析 Markdown
        const ast = await processor.parse(outlineText);
        const result = await processor.run(ast);

        // 转换 AST 为更易读的大纲结构
        const outline = this.convertAstToOutlineStructure(result);

        return { outline };
      } catch (remarkError) {
        console.error('使用 remark 解析也失败:', remarkError);

        // 最后尝试使用 AI 转换为 JSON
        return await this.convertToJson(outlineText);
      }
    }
  }
}
