# Expert 组件实例化重构计划

## 状态：已完成 ✅

## 背景

当前 Expert 系统存在**双源头问题**：
- `Workspace.ts` 中的 `getComponents()` 方法返回的组件**未被使用**
- 实际使用的是 `config.json` 中的 `components` 数组

这导致：
1. 用户在 `getComponents()` 中定义的组件被忽略
2. `componentTokenMap` 用于解析 DI Token，设计脆弱
3. 数据流断裂，不符合直觉

## 目标

1. 移除从 config.json 获取组件的逻辑
2. 改为直接的实例传递（不使用 DI 容器）
3. 确保能从 ExpertWorkspace 入口获取到组件实例

## 新的组件流程

```
Workspace.ts:getComponents()  ──✓──→  ExpertConfig.components  ──→  VirtualWorkspace
```

- 单一来源：组件定义只来自 `Workspace.ts` 的 `getComponents()` 方法
- 直接实例：直接传递 `ToolComponent` 实例或工厂函数
- 简化配置：config.json 只包含元数据，不包含运行时配置

---

## 已完成的修改

### 1. ExpertWorkspaceBase.ts

- ✅ 添加 `ComponentFactory` 类型
- ✅ 添加 `ComponentDefinition` 接口（支持带 ID 的组件）
- ✅ 简化 `getComponents()` 返回类型：`ComponentFactory[]`
- ✅ 新增 `getComponentsWithIds()` 方法（可选，用于自定义组件 ID）
- ✅ 移除 `componentTokenMap` 属性
- ✅ 更新工具方法

### 2. ExpertFactory.ts

- ✅ 移除 `ExpertConfigJson` 中的 `components` 字段
- ✅ 移除 `ComponentDefinitionJson` 接口
- ✅ 修改 `buildComponents()` 从 `workspace.getComponents()` 获取组件
- ✅ 更新使用文档

### 3. ExpertExecutor.ts

- ✅ 简化组件注册注释

### 4. types.ts

- ✅ 移除 `ExpertComponentDefinition` 中的 `symbol` 类型
- ✅ 添加 `priority` 属性

### 5. 模板文件

- ✅ `templates/my-expert/config.json` - 移除 `components` 字段
- ✅ `templates/my-expert/Workspace.ts` - 更新组件定义示例

### 6. 现有 Expert

- ✅ `builtin/test-expert/config.json` - 移除 `components` 字段
- ✅ `builtin/test-expert/Workspace.ts` - 更新组件定义示例
- ✅ `builtin/meta-analysis-article-retrieval/config.json` - 移除 `components` 字段
- ✅ `builtin/meta-analysis-article-retrieval/Workspace.ts` - 使用直接实例

---

## 验证

✅ 构建成功：`npx nx build agent-lib`

---

## 新的使用方式

```typescript
// Workspace.ts
class MyExpertWorkspace extends ExpertWorkspaceBase {
    // 方式1: 直接实例
    static override getComponents() {
        return [
            new BibliographySearchComponent(),
        ];
    }

    // 方式2: 带自定义ID
    static override getComponentsWithIds() {
        return [
            { id: 'search', component: new BibliographySearchComponent() },
            { id: 'vfs', component: () => new VirtualFileSystemComponent() },
        ];
    }
}
```
