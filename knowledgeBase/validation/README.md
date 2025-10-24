# 实体-知识关系验证系统

本验证系统用于全面测试实体-知识关系的正确性，包括创建、查询、更新和删除操作。基于"肾病综合征的临床表现可总结为'三高一低'"的案例进行验证。

## 文件结构

```
validation/
├── entity-knowledge-relationship-validation.ts  # 实体-知识关系验证测试
├── relationship-visualizer.ts                   # 关系可视化工具
├── complex-scenario-test.ts                     # 复杂场景测试
├── validation-runner.ts                         # 验证运行器
└── README.md                                    # 本文件
```

## 功能特性

### 1. 实体-知识关系验证 (`entity-knowledge-relationship-validation.ts`)

验证完整的实体-知识关系创建流程，包括：

- ✅ 实体创建和验证
- ✅ 知识创建和关联
- ✅ 双向关系查询
- ✅ 知识层次结构验证
- ✅ 向量相似性搜索测试

**测试案例：** 肾病综合征 → 临床表现 → 各种症状（大量蛋白尿、低蛋白血症、水肿、高脂血症）

### 2. 关系可视化工具 (`relationship-visualizer.ts`)

提供多种格式的可视化输出：

- 📊 **HTML可视化**: 生成交互式HTML页面展示关系结构
- 📈 **DOT图**: 生成Graphviz兼容的DOT格式图
- 🔄 **Mermaid图表**: 生成Mermaid流程图语法
- 📋 **JSON统计**: 生成详细的关系统计数据

### 3. 复杂场景测试 (`complex-scenario-test.ts`)

测试复杂关系建立和查询场景：

- 🏥 **多实体关联**: 医疗知识体系（疾病、症状、治疗）
- 📚 **深度层次结构**: 多层嵌套知识结构
- 🔍 **复杂查询**: 多跳查询、路径查找、相似性搜索
- ⚡ **并发操作**: 高并发情况下的系统稳定性
- 📊 **大数据量**: 大量数据处理性能测试

### 4. 验证运行器 (`validation-runner.ts`)

统一运行所有验证测试并生成综合报告：

- 🚀 自动化测试执行
- 📊 详细测试报告生成
- 📈 成功率统计
- 💡 优化建议

## 使用方法

### 快速开始

```bash
# 运行所有验证测试
npx tsx knowledgeBase/validation/validation-runner.ts

# 运行特定验证
npx tsx knowledgeBase/validation/entity-knowledge-relationship-validation.ts
npx tsx knowledgeBase/validation/complex-scenario-test.ts
```

### 编程方式使用

```typescript
import { runAllValidations } from './validation/validation-runner';

// 运行所有验证
const results = await runAllValidations();
console.log('验证结果:', results);

// 运行特定验证
import { runEntityKnowledgeRelationshipValidation } from './validation/entity-knowledge-relationship-validation';
const entityResults = await runEntityKnowledgeRelationshipValidation();
```

### 使用可视化工具

```typescript
import { createRelationshipVisualizer } from './validation/relationship-visualizer';

// 创建可视化器
const visualizer = createRelationshipVisualizer(knowledgeStorage, entityStorage);

// 生成HTML可视化
const html = await visualizer.generateHtmlVisualization(entityId);

// 生成Mermaid图表
const mermaid = await visualizer.generateMermaidDiagram(entityId);

// 生成关系统计
const stats = await visualizer.generateRelationshipStats(entityId);
```

## 验证内容详解

### 1. 实体-知识关系创建流程

验证以下流程的正确性：

```
肾病综合征 (实体)
    ↓
临床表现 (知识)
    ↓
┌─────────────┬─────────────┬─────────────┬─────────────┐
│ 大量蛋白尿   │ 低蛋白血症   │ 水肿        │ 高脂血症    │
│ (实体)      │ (实体)      │ (实体)      │ (实体)      │
└─────────────┴─────────────┴─────────────┴─────────────┘
```

### 2. 双向关系查询

验证：
- 实体 → 知识：查询实体的所有下属知识
- 知识 → 实体：通过知识反向查询关联实体

### 3. 知识层次结构

验证知识的父子关系：
- 根知识 → 子知识 → 孙知识
- 层次结构的正确性和完整性
- Markdown渲染的正确性

### 4. 复杂场景

#### 多实体关联场景
创建医疗知识体系：
- 糖尿病（疾病）
- 糖尿病肾病（并发症）
- 胰岛素治疗（治疗）
- 相互关系：疾病 → 并发症，疾病 → 治疗

#### 深度层次结构场景
创建心血管疾病知识树：
- 心血管疾病
  - 冠心病
    - 稳定型心绞痛
    - 不稳定型心绞痛
    - 心肌梗死
  - 高血压
    - 原发性高血压
    - 继发性高血压
  - 心力衰竭
    - 收缩性心力衰竭
    - 舒张性心力衰竭

## 测试结果解读

### 成功指标

- ✅ **实体-知识创建流程**: 能够正确创建实体和知识并建立关系
- ✅ **知识层次结构**: 知识的父子关系正确，层次结构完整
- ✅ **向量相似性搜索**: 向量搜索接口正常工作
- ✅ **多实体关联**: 多个实体间的关系正确建立
- ✅ **深度层次结构**: 深层嵌套结构正确处理
- ✅ **复杂查询**: 多跳查询、路径查找等功能正常
- ✅ **并发操作**: 并发情况下系统稳定
- ✅ **大数据量**: 大量数据处理性能良好
- ✅ **可视化生成**: 各种格式的可视化正确生成

### 失败处理

如果测试失败，请检查：

1. **数据库连接**: 确保MongoDB连接正常
2. **依赖项**: 确保所有依赖项正确安装
3. **配置**: 检查数据库配置和环境变量
4. **权限**: 确保有足够的数据库操作权限
5. **资源**: 检查系统资源是否充足

## 性能基准

### 预期性能指标

- **实体创建**: < 100ms
- **知识创建**: < 200ms
- **关系查询**: < 50ms
- **层次结构查询**: < 100ms
- **可视化生成**: < 500ms
- **并发操作**: 10个并发请求 < 5s
- **大数据量**: 50个实体 + 50个知识 < 10s

## 扩展和定制

### 添加新的验证测试

1. 在相应的验证文件中添加新的测试方法
2. 在`validation-runner.ts`中注册新测试
3. 更新报告生成逻辑

### 添加新的可视化格式

1. 在`relationship-visualizer.ts`中添加新的生成方法
2. 更新测试用例
3. 更新文档

### 自定义测试案例

可以通过修改验证文件中的测试数据来适应不同的业务场景：

```typescript
// 自定义实体数据
const customEntity = {
  name: ['自定义实体'],
  tags: ['自定义'],
  definition: '自定义实体的定义',
};

// 自定义知识内容
const customKnowledge = {
  scope: '自定义知识范围',
  content: '自定义知识内容',
  childKnowledgeId: [],
};
```

## 故障排除

### 常见问题

1. **连接超时**
   - 检查MongoDB服务状态
   - 验证连接字符串
   - 检查网络连接

2. **权限错误**
   - 验证数据库用户权限
   - 检查集合访问权限

3. **内存不足**
   - 减少并发测试数量
   - 优化大数据量测试参数

4. **类型错误**
   - 检查TypeScript类型定义
   - 确保接口实现正确

### 调试模式

启用详细日志：

```typescript
import createLoggerWithPrefix from 'lib/logManagement/logger';

// 设置日志级别为DEBUG
process.env.LOG_LEVEL = 'debug';
```

## 贡献指南

1. 遵循现有的代码风格
2. 添加适当的测试用例
3. 更新相关文档
4. 确保所有测试通过

## 许可证

本项目遵循主项目的许可证条款。