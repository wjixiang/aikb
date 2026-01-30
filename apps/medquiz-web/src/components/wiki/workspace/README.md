# Markdown 文档工作区组件

这是一个完整的 Markdown 文档浏览和编辑工作区组件系统，专为知识管理和文档浏览而设计。

## 组件结构

### 1. WorkSpace (主工作区)

- 管理整个文档工作区的状态
- 处理标签页生命周期
- 提供文档缓存机制
- 支持初始文档加载

### 2. PageTabs (页面标签栏)

- 显示和管理打开的标签页
- 支持拖拽重新排序
- 显示文档修改状态
- 支持快速关闭标签页

### 3. Leaf (文档展示组件)

- 使用现有的 DocumentDisplay 组件进行 Markdown 渲染
- 处理文档加载和错误状态
- 支持文档内容更新回调

## 功能特性

### ✅ 已实现功能

- [x] 多标签页文档浏览
- [x] 拖拽标签页重新排序
- [x] 文档加载和缓存
- [x] 错误处理和加载状态
- [x] 响应式设计
- [x] 与现有 DocumentDisplay 集成
- [x] 文档打开/关闭事件回调

### 🔄 待实现功能

- [ ] 文档搜索功能
- [ ] 文件树侧边栏
- [ ] 文档编辑功能
- [ ] 自动保存
- [ ] 历史记录
- [ ] 书签功能

## 使用方法

### 基本使用

```tsx
import { WorkSpace } from "@/components/wiki/workspace";

function App() {
  return (
    <div className="h-screen">
      <WorkSpace
        initialPath="README"
        basePath="/wiki"
        onDocumentOpen={(path) => console.log("打开:", path)}
        onDocumentClose={(path) => console.log("关闭:", path)}
      />
    </div>
  );
}
```

### 高级使用

```tsx
import { WorkSpace } from "@/components/wiki/workspace";

function AdvancedExample() {
  const handleDocumentOpen = async (path: string) => {
    // 自定义文档打开逻辑
    console.log("文档已打开:", path);
  };

  const handleDocumentClose = async (path: string) => {
    // 自定义文档关闭逻辑
    console.log("文档已关闭:", path);
  };

  return (
    <WorkSpace
      initialPath="getting-started"
      basePath="/docs"
      className="border rounded-lg shadow-lg"
      onDocumentOpen={handleDocumentOpen}
      onDocumentClose={handleDocumentClose}
    />
  );
}
```

## API 参考

### WorkSpace Props

| 属性              | 类型                     | 默认值    | 说明               |
| ----------------- | ------------------------ | --------- | ------------------ |
| `initialPath`     | `string`                 | -         | 初始打开的文档路径 |
| `basePath`        | `string`                 | `'/wiki'` | 基础路径           |
| `onDocumentOpen`  | `(path: string) => void` | -         | 文档打开回调       |
| `onDocumentClose` | `(path: string) => void` | -         | 文档关闭回调       |
| `className`       | `string`                 | -         | 自定义样式类       |

### 类型定义

```typescript
interface DocumentTab {
  id: string;
  title: string;
  path: string;
  content?: string;
  isActive: boolean;
  isDirty?: boolean;
  lastModified?: Date;
}

interface WorkSpaceProps {
  initialPath?: string;
  basePath?: string;
  onDocumentOpen?: (path: string) => void;
  onDocumentClose?: (path: string) => void;
  className?: string;
}
```

## 样式定制

组件使用 Tailwind CSS 进行样式设计，可以通过以下方式自定义：

```css
/* 自定义标签页样式 */
.tab-item {
  @apply bg-blue-50 hover:bg-blue-100;
}

.tab-item.active {
  @apply bg-white border-blue-600 text-blue-700;
}

/* 自定义文档显示区域 */
.document-display-wrapper {
  @apply bg-gray-50;
}
```

## 文件结构

```
src/components/wiki/workspace/
├── WorkSpace.tsx          # 主工作区组件
├── PageTabs.tsx          # 标签页组件
├── Leaf.tsx              # 文档展示组件
├── types.ts              # TypeScript 类型定义
├── workspace.css         # 样式文件
├── index.ts              # 导出文件
├── WorkSpaceExample.tsx  # 使用示例
└── README.md             # 本文档
```

## 依赖关系

- `uuid`: 用于生成唯一标签页 ID
- `lucide-react`: 图标库
- 现有的 `DocumentDisplay` 组件用于 Markdown 渲染

## 测试

访问 `/wiki-test` 路由来测试工作区功能。

## 注意事项

1. 确保 `/api/note/fetch` API 端点正常工作
2. 文档路径应该是相对于 `basePath` 的相对路径
3. 大文档加载可能需要一些时间，组件会显示加载状态
4. 错误会被捕获并显示友好的错误信息

## 贡献指南

欢迎提交 Issue 和 Pull Request 来改进这个工作区组件系统。
