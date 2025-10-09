# 文本切片工具 (Text Chunking Tool)

这个工具提供了基于大纲的文本切片功能，特别适用于已经转换为markdown格式且所有大纲均为H1的文本。

## 功能特性

- **基于H1大纲的切片**：将markdown文本按照H1标题进行切分
- **基于段落的切片**：将文本按段落进行切分
- **通用接口**：提供统一的接口支持多种切片策略
- **类型安全**：完整的TypeScript类型定义
- **完善的测试**：包含全面的单元测试

## API 参考

### h1Chunking(text: string): ChunkResult[]

基于H1标题将文本切分为多个块。

**参数：**
- `text`: markdown格式的文本，所有大纲均为H1

**返回值：**
- `ChunkResult[]`: 切分后的文本块数组

**示例：**
```typescript
import { h1Chunking } from './chunkingTool';

const markdown = `# 人工智能简介
这是人工智能的介绍内容。

# 机器学习基础
这是机器学习的内容。`;

const chunks = h1Chunking(markdown);
console.log(chunks);
// 输出:
// [
//   { title: '人工智能简介', content: '# 人工智能简介\n这是人工智能的介绍内容。', index: 0 },
//   { title: '机器学习基础', content: '# 机器学习基础\n这是机器学习的内容。', index: 1 }
// ]
```

### paragraphChunking(text: string): string[]

基于段落的文本切片功能。

**参数：**
- `text`: 输入文本

**返回值：**
- `string[]`: 切分后的段落数组

**示例：**
```typescript
import { paragraphChunking } from './chunkingTool';

const text = `这是第一段。

这是第二段。

这是第三段。`;

const paragraphs = paragraphChunking(text);
console.log(paragraphs);
// 输出: ['这是第一段。', '这是第二段。', '这是第三段。']
```

### chunkText(text: string, strategy: 'h1' | 'paragraph'): ChunkResult[] | string[]

通用文本切片函数，支持多种策略。

**参数：**
- `text`: 输入文本
- `strategy`: 切片策略，'h1' 或 'paragraph'，默认为 'h1'

**返回值：**
- 根据策略返回不同类型的结果

**示例：**
```typescript
import { chunkText } from './chunkingTool';

// 使用默认的h1策略
const h1Chunks = chunkText(markdown);

// 使用paragraph策略
const paragraphs = chunkText(text, 'paragraph');
```

## 类型定义

### ChunkResult

```typescript
interface ChunkResult {
  title: string;    // H1标题文本
  content: string;  // 包含标题的完整内容
  index: number;    // 块的索引位置
}
```

## 使用场景

1. **文档处理**：将长文档按照章节标题切分为独立的部分
2. **知识库构建**：将结构化文档转换为可检索的知识块
3. **内容分析**：对文档的不同部分进行独立分析
4. **AI训练数据准备**：将大文档切分为适合模型训练的小块

## 特殊处理

- **无H1标题的文本**：当输入文本不包含任何H1标题时，`h1Chunking`函数会将整个文本作为一个块返回，标题为"Untitled"
- **复杂标题**：支持包含特殊字符的H1标题
- **内容保留**：每个块包含完整的H1标题及其后的所有内容，直到下一个H1标题

## 测试

运行测试以验证功能：

```bash
pnpm test:unit knowledgeBase/lib/chunking/paragraphChunking.test.ts
```

## 示例

查看示例文件了解详细用法：

```bash
cd knowledgeBase/lib/chunking && npx tsx example.ts