import { NextResponse } from 'next/server';

export async function GET() {
  // 这里可以从数据库或文件系统获取 Markdown 内容
  // 这里只是一个示例
  const markdownContent = `
# Markdown 示例

这是一个使用 **remark** 渲染的 Markdown 文本。

## 功能列表

- 支持**粗体**和*斜体*
- 支持[链接](https://nextjs.org)
- 支持代码块

\`\`\`javascript
function hello() {
  console.log("Hello, world!");
}
\`\`\`

> 这是一个引用块

### 表格支持

| 名称 | 描述 |
| ---- | ---- |
| Next.js | React 框架 |
| Remark | Markdown 处理器 |

![示例图片](https://via.placeholder.com/150)
  `;

  return NextResponse.json({ content: markdownContent });
}
