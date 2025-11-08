# Milvus CLI Tools

## BM25 Search CLI

### Installation

```bash
npm install -g tsx
```

### Usage

```bash
npx tsx src/lib/milvus/bm25SearchCLI.ts -q "搜索词" -c 集合名 [选项]
```

### Options

- `-c, --collection`: Milvus集合名称 (默认: default_collection)
- `-q, --query`: 搜索查询文本 (必填)
- `-l, --limit`: 返回结果数量 (默认: 10)
- `-o, --output`: 输出格式 (json|text, 默认: text)
- `-e, --expr`: 过滤表达式
- `-p, --partitionNames`: 分区名称数组

### Examples

```bash
# 基本搜索
npx tsx src/lib/milvus/bm25SearchCLI.ts -q "病毒性肝炎" -c medical_notes

# 限制结果数量
npx tsx src/lib/milvus/bm25SearchCLI.ts -q "糖尿病" -c medical_notes -l 5

# JSON格式输出
npx tsx src/lib/milvus/bm25SearchCLI.ts -q "心脏病" -c medical_notes -o json
```

### Notes

- 支持中文搜索查询
- 需要先配置好Milvus连接环境变量
- 确保集合已创建并包含BM25索引
