# RAG Quiz Analysis CLI Tool

这个CLI工具使用RAG（Retrieval-Augmented Generation）技术为医学题目生成详细的解析内容。

## 功能特性

- 🎯 **智能解析生成**: 使用RAG技术基于医学知识库生成高质量解析
- 🔍 **灵活的题目筛选**: 支持按分类、类型、单元、来源、年份等条件筛选题目
- ⚡ **高效并发处理**: 支持并发处理，提高处理效率
- 📊 **实时进度显示**: 显示处理进度、成功/失败统计和处理速度
- 🔄 **错误重试机制**: 自动重试失败的任务
- 🛡️ **安全模式**: 支持试运行模式，不实际修改数据
- 🌐 **多语言支持**: 支持中文和英文解析生成

## 安装依赖

确保已安装项目依赖：

```bash
pnpm install
```

## 使用方法

### 基本用法

```bash
# 运行RAG分析
pnpm rag-quiz-analysis

# 查看帮助
pnpm rag-quiz-analysis --help
```

### 参数说明

| 参数            | 简写 | 说明                       | 示例                       |
| --------------- | ---- | -------------------------- | -------------------------- |
| `--class`       | `-c` | 题目分类                   | `内科学`, `外科学`         |
| `--mode`        | `-m` | 题目类型                   | `A1`, `A2`, `A3`, `B`, `X` |
| `--unit`        | `-u` | 题目单元                   | `呼吸系统`, `循环系统`     |
| `--source`      | `-s` | 题目来源                   | `执业医师`, `卫生资格考试` |
| `--year`        | `-y` | 年份                       | `2023`, `2022`             |
| `--limit`       | `-l` | 处理题目数量限制           | `50`, `100`                |
| `--concurrency` |      | 并发处理数量               | `5`, `10`                  |
| `--dry-run`     |      | 试运行模式，不实际修改数据 |                            |
| `--force`       |      | 强制重新生成已有解析的内容 |                            |
| `--language`    |      | 语言设置 (zh/en)           | `zh`, `en`                 |

### 使用示例

#### 1. 处理内科学的所有A1型题

```bash
pnpm rag-quiz-analysis --class 内科学 --mode A1
```

#### 2. 处理特定来源的题目，限制数量

```bash
pnpm rag-quiz-analysis --source "执业医师" --limit 50
```

#### 3. 试运行模式（不实际修改数据）

```bash
pnpm rag-quiz-analysis --class 外科学 --dry-run
```

#### 4. 强制重新生成已有解析

```bash
pnpm rag-quiz-analysis --class 内科学 --force
```

#### 5. 高并发处理

```bash
pnpm rag-quiz-analysis --class 内科学 --concurrency 10
```

#### 6. 组合条件筛选

```bash
pnpm rag-quiz-analysis --class 内科学 --mode A2 --year 2023 --limit 30
```

## 输出示例

```
🚀 开始RAG Quiz分析任务
参数: {
  "class": "内科学",
  "mode": "A1",
  "limit": "10",
  "dryRun": false
}

开始RAG分析处理...
查询条件: {"cls":["内科学"],"mode":["A1"],"quizNum":10,"randomize":false}
找到 10 个需要处理的题目
处理进度 |██████████████████████████████████████████████████████████████████████████████████████████████████████| 100% | 10/10 | 成功: 9 | 失败: 1 | 速度: 12.5 题/分钟
✅ Quiz 6423f8a9c1b9e8a3b4c5d6e7 处理成功
❌ Quiz 6423f8a9c1b9e8a3b4c5d6e8 处理失败: Network error

处理完成！总计: 10, 成功: 9, 失败: 1, 耗时: 0.80 分钟
✅ 任务完成
```

## 技术细节

### 工作流程

1. **数据获取**: 使用 `QuizStorage` 根据筛选条件获取题目数据
2. **内容格式化**: 将题目格式化为适合RAG处理的查询文本
3. **RAG处理**: 调用 `rag_workflow` 使用 `glm-4.5-flash` 模型生成解析
4. **结果保存**: 将生成的解析内容保存到数据库的 `analysis.ai_analysis` 字段
5. **进度跟踪**: 实时显示处理进度和统计信息

### 重试机制

- 默认重试次数：3次
- 重试延迟：指数退避策略（2秒、4秒、8秒）
- 重试条件：网络错误、API超时等可恢复错误

### 并发控制

- 默认并发数：5
- 可通过 `--concurrency` 参数调整
- 使用 `p-limit` 库控制并发数量

### 数据库更新

解析内容保存到 `quiz` 集合的 `analysis.ai_analysis` 字段：

```typescript
{
  _id: ObjectId,
  // ... 其他字段
  analysis: {
    point: string,
    discuss: string,
    ai_analysis: string,  // RAG生成的解析内容
    link: string[]
  }
}
```

## 注意事项

1. **环境变量**: 确保设置了必要的环境变量（数据库连接、API密钥等）
2. **网络连接**: RAG处理需要网络连接访问外部API
3. **资源使用**: 高并发处理会消耗较多系统资源，请根据服务器配置调整并发数
4. **数据备份**: 大规模处理前建议备份数据库
5. **监控**: 长时间运行的任务建议监控系统资源使用情况

## 故障排除

### 常见错误

1. **数据库连接失败**
   - 检查数据库连接字符串
   - 确认数据库服务正在运行

2. **API调用失败**
   - 检查网络连接
   - 确认API密钥配置正确
   - 检查API服务状态

3. **内存不足**
   - 减少并发数量
   - 减少 `--limit` 参数值

4. **权限错误**
   - 确认数据库用户有读写权限
   - 检查文件系统权限

### 调试模式

设置环境变量启用调试输出：

```bash
DEBUG=true pnpm rag-quiz-analysis --class 内科学
```

## 开发说明

### 代码结构

```
src/script/rag-quiz-analysis.ts
├── QuizRAGAnalyzer          # 主分析器类
├── buildSelector()          # 构建查询选择器
├── formatQuizForRAG()       # 格式化题目内容
├── generateAnalysisWithRAG() # RAG分析生成
├── updateQuizAnalysis()     # 更新数据库
├── processQuizWithRetry()   # 带重试的处理逻辑
└── processQuizzes()         # 批量处理主逻辑
```

### 扩展功能

1. **添加新的筛选条件**: 修改 `buildSelector()` 方法
2. **自定义RAG配置**: 修改 `generateAnalysisWithRAG()` 方法
3. **更改输出格式**: 修改进度条和日志输出部分
4. **添加新的处理模式**: 扩展 `QuizRAGAnalyzer` 类

## 许可证

本项目采用 MIT 许可证。
