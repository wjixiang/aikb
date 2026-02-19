# Memory Context 改进方案

## 问题分析

### 问题 1：缺乏 Task Context 注入

**当前情况**：
```typescript
// Agent.ts
async start(query: string) {
    await this.requestLoop(query);  // query 只传给 requestLoop
}

// requestLoop 中
this.memoryModule.startTurn(currentWorkspaceContext);  // 只传入 workspace context
```

**问题**：
- 初始的用户 query（任务目标）没有被注入到思考环节
- LLM 在思考时看不到"用户最初想要做什么"
- 缺少任务的整体目标和上下文

**示例场景**：
```
用户: "请帮我搜索关于 SGLT2 抑制剂对 2 型糖尿病患者心血管结局影响的文献"

Turn 1 思考环节收到的信息:
  ✅ Workspace Context: "Medical Bibliography Searching workspace..."
  ❌ Task Context: 缺失！LLM 不知道用户的具体任务

结果: LLM 可能不清楚具体要搜索什么
```

### 问题 2：摘要不够详细

**当前情况**：
```typescript
const summaryPrompt = `Generate a concise summary (2-3 sentences)...`;
```

**问题**：
- 摘要被限制为 2-3 句话，过于简洁
- 无法详细记录每一步的操作和结果
- 丢失了重要的细节信息

**示例**：
```
实际发生的事情:
1. 搜索 PubMed，使用关键词 "SGLT2 inhibitors cardiovascular outcomes"
2. 找到 156 篇文章
3. 筛选出 15 篇系统综述
4. 下载了其中 5 篇全文
5. 提取了关键数据

当前摘要（2-3句话）:
"搜索了 PubMed 数据库，找到相关文献并进行了筛选。
下载了部分全文并提取了数据。"

❌ 丢失了: 具体关键词、文章数量、筛选标准、具体下载了哪些文章
```

## 改进方案

### 方案 1：添加 Task Context

#### 1.1 在 Turn 中存储 Task Context

修改 `Turn` 接口：

```typescript
// Turn.ts
export interface Turn {
    id: string;
    turnNumber: number;
    timestamp: number;
    status: TurnStatus;

    // 新增：任务上下文
    taskContext?: string;  // 用户的初始任务/query

    messages: ApiMessage[];
    workspaceContext: string;
    thinkingPhase?: {...};
    toolCalls: ToolCallResult[];
    summary?: string;
    insights?: string[];
    tokenUsage: {...};
}
```

#### 1.2 修改 startTurn 方法

```typescript
// MemoryModule.ts
startTurn(workspaceContext: string, taskContext?: string): Turn {
    // Complete previous turn if exists
    if (this.currentTurn && this.currentTurn.status !== TurnStatus.COMPLETED) {
        this.completeTurn();
    }

    // Create new turn with task context
    this.currentTurn = this.turnStore.createTurn(workspaceContext, taskContext);
    return this.currentTurn;
}
```

```typescript
// TurnMemoryStore.ts
createTurn(workspaceContext: string, taskContext?: string): Turn {
    this.currentTurnNumber++;
    const turn: Turn = {
        id: `turn_${this.currentTurnNumber}_${Date.now()}`,
        turnNumber: this.currentTurnNumber,
        timestamp: Date.now(),
        status: TurnStatus.PENDING,
        messages: [],
        workspaceContext,
        taskContext,  // 新增
        toolCalls: [],
        tokenUsage: { thinking: 0, action: 0, total: 0 }
    };
    this.turns.set(turn.id, turn);
    this.turnNumberToId.set(this.currentTurnNumber, turn.id);
    return turn;
}
```

#### 1.3 在思考 Prompt 中注入 Task Context

```typescript
// MemoryModule.ts
private buildThinkingPrompt(
    roundNumber: number,
    workspaceContext: string,
    previousRounds: ThinkingRound[]
): { systemPrompt: string; context: string; history: string[] } {
    const systemPrompt = `You are in the THINKING phase of an agent framework.

Your task is to:
1. Understand the user's overall task/goal
2. Analyze the current situation based on conversation history and workspace context
3. Review accumulated summaries from previous turns
4. Decide whether to continue thinking or proceed to action
...`;

    const accumulatedSummaries = this.getAccumulatedSummaries();

    // 获取当前 Turn 的 task context
    const taskContext = this.currentTurn?.taskContext
        ? `\n=== TASK CONTEXT ===\nUser's Goal: ${this.currentTurn.taskContext}\n`
        : '';

    const context = `${taskContext}
=== WORKSPACE CONTEXT ===
${workspaceContext}

${accumulatedSummaries}

=== PREVIOUS THINKING ROUNDS ===
${previousRounds.map(r => `Round ${r.roundNumber}: ${r.content}`).join('\n\n')}
`;

    return { systemPrompt, context, history };
}
```

#### 1.4 在 Agent 中传递 Task Context

```typescript
// Agent.ts
async start(query: string): Promise<Agent> {
    this._status = 'running';
    this._initialQuery = query;  // 保存初始 query
    await this.requestLoop(query);
    return this;
}

// 在 requestLoop 中
if (needsNewTurn) {
    // 第一个 Turn 传入 task context
    const taskContext = this.memoryModule.getTurnStore().getCurrentTurnNumber() === 0
        ? this._initialQuery
        : undefined;

    this.memoryModule.startTurn(currentWorkspaceContext, taskContext);
    needsNewTurn = false;
}
```

### 方案 2：增强摘要详细程度

#### 2.1 修改摘要生成 Prompt

```typescript
// MemoryModule.ts
private async generateSummary(
    workspaceContext: string,
    thinkingRounds: ThinkingRound[],
    toolResults?: any[]
): Promise<string> {
    const previousSummaries = this.getAccumulatedSummaries();

    const summaryPrompt = `Generate a DETAILED summary of what happened in this turn.

${previousSummaries}

WORKSPACE CONTEXT:
${workspaceContext.substring(0, 1000)}...

THINKING ROUNDS:
${thinkingRounds.map(r => `Round ${r.roundNumber}: ${r.content.substring(0, 500)}`).join('\n\n')}
// 从 200 增加到 500 字符

TOOL RESULTS:
${toolResults?.map(r => `${r.toolName}: ${r.success ? 'success' : 'failed'}\nResult: ${JSON.stringify(r.result).substring(0, 200)}`).join('\n\n') || 'None'}
// 增加工具结果的详细信息

Generate a DETAILED summary that includes:
1. What actions were taken (be specific about tools used, parameters, etc.)
2. What results were obtained (include key numbers, findings, etc.)
3. What decisions were made and why
4. What the next steps might be

The summary should be 5-8 sentences and capture all important details.
If this turn builds upon previous turns, mention the connection.`;

    try {
        const response = await this.apiClient.makeRequest(
            'You are a detailed summarization assistant. Generate comprehensive summaries that preserve important details.',
            summaryPrompt,
            [],
            { timeout: 30000 },  // 增加超时时间
            []
        );

        return this.extractContent(response);
    } catch (error) {
        console.error('Summary generation failed:', error);
        return 'Summary generation failed';
    }
}
```

#### 2.2 添加结构化摘要选项

可以考虑使用结构化的摘要格式：

```typescript
export interface StructuredSummary {
    overview: string;           // 总体概述（1-2句话）
    actionsToken: string[];     // 执行的操作列表
    results: string[];          // 获得的结果列表
    decisions: string[];        // 做出的决策列表
    nextSteps?: string[];       // 下一步计划
}

export interface Turn {
    // ...
    summary?: string;                      // 保留简短摘要
    detailedSummary?: StructuredSummary;  // 新增：结构化详细摘要
    insights?: string[];
    // ...
}
```

生成结构化摘要：

```typescript
private async generateStructuredSummary(
    workspaceContext: string,
    thinkingRounds: ThinkingRound[],
    toolResults?: any[]
): Promise<StructuredSummary> {
    const summaryPrompt = `Analyze the following turn and generate a structured summary.

THINKING ROUNDS:
${thinkingRounds.map(r => r.content).join('\n\n')}

TOOL RESULTS:
${JSON.stringify(toolResults, null, 2)}

Generate a JSON response with this structure:
{
    "overview": "Brief 1-2 sentence overview",
    "actions": ["Action 1 with details", "Action 2 with details", ...],
    "results": ["Result 1 with numbers/data", "Result 2 with numbers/data", ...],
    "decisions": ["Decision 1 and reasoning", "Decision 2 and reasoning", ...],
    "nextSteps": ["Next step 1", "Next step 2", ...]
}`;

    const response = await this.apiClient.makeRequest(
        'You are a structured summarization assistant. Generate detailed JSON summaries.',
        summaryPrompt,
        [],
        { timeout: 30000 },
        []
    );

    return JSON.parse(this.extractContent(response));
}
```

### 方案 3：分层摘要系统

实现多层次的摘要：

```typescript
export interface Turn {
    // ...

    // 三层摘要
    summaries: {
        brief: string;           // 简短摘要（2-3句话）- 用于快速浏览
        detailed: string;        // 详细摘要（5-8句话）- 用于理解细节
        structured?: StructuredSummary;  // 结构化摘要 - 用于程序化访问
    };

    insights?: string[];
    // ...
}
```

在不同场景使用不同层次：

```typescript
// 在思考 prompt 中使用简短摘要（节省 tokens）
getAccumulatedSummaries(level: 'brief' | 'detailed' = 'brief'): string {
    const summaries = this.turnStore.getAllSummaries();

    return summaries.map(s => {
        const summary = level === 'brief' ? s.summaries.brief : s.summaries.detailed;
        return `[Turn ${s.turnNumber}] ${summary}`;
    }).join('\n\n');
}

// 用户查看历史时使用详细摘要
getUserFacingSummary(turnNumber: number): string {
    const turn = this.turnStore.getTurnByNumber(turnNumber);
    return turn?.summaries.detailed || '';
}
```

## 实施优先级

### 高优先级（立即实施）

1. **添加 Task Context 注入**
   - 修改 Turn 接口添加 `taskContext` 字段
   - 修改 `startTurn` 方法接受 `taskContext` 参数
   - 在思考 prompt 中注入 task context
   - 在 Agent 中传递初始 query

2. **增强摘要详细程度**
   - 将摘要从 2-3 句话扩展到 5-8 句话
   - 增加思考轮次截取长度（200 → 500 字符）
   - 添加工具结果的详细信息
   - 更新 prompt 要求包含具体细节

### 中优先级（后续优化）

3. **结构化摘要**
   - 实现 `StructuredSummary` 接口
   - 添加结构化摘要生成方法
   - 提供程序化访问接口

### 低优先级（可选）

4. **分层摘要系统**
   - 实现三层摘要（brief/detailed/structured）
   - 根据使用场景选择合适的层次
   - 优化 token 使用

## 预期效果

### Task Context 注入后

**修改前**：
```
思考环节输入:
  Workspace Context: "Medical Bibliography Searching workspace"
  Previous Summaries: [...]

LLM: "我不太确定要搜索什么..."
```

**修改后**：
```
思考环节输入:
  Task Context: "搜索关于 SGLT2 抑制剂对 2 型糖尿病患者心血管结局影响的文献"
  Workspace Context: "Medical Bibliography Searching workspace"
  Previous Summaries: [...]

LLM: "用户想要搜索 SGLT2 抑制剂的文献，我应该使用 PubMed 搜索工具..."
```

### 详细摘要后

**修改前（2-3句话）**：
```
"搜索了 PubMed 数据库，找到相关文献并进行了筛选。
下载了部分全文并提取了数据。"
```

**修改后（5-8句话）**：
```
"使用关键词 'SGLT2 inhibitors cardiovascular outcomes type 2 diabetes'
搜索 PubMed 数据库，共找到 156 篇相关文献。
应用筛选条件（发表年份 2018-2024，文章类型为系统综述或 Meta 分析），
筛选出 15 篇高质量文献。
下载了其中 5 篇全文（PMID: 12345678, 23456789, 34567890, 45678901, 56789012），
这些文章共纳入 45,678 名患者的数据。
初步提取显示 SGLT2 抑制剂可降低 14% 的主要心血管不良事件风险（HR 0.86, 95% CI 0.80-0.93）。
下一步需要详细提取每篇文章的具体数据并进行质量评估。"
```

## 成本分析

### Task Context 注入

**Token 增加**：
- 每次思考轮次增加约 50-100 tokens（取决于 query 长度）
- 只在第一个 Turn 有影响
- 成本增加：可忽略

### 详细摘要

**Token 增加**：
- 输入：思考轮次截取从 200 → 500 字符（+150% per round）
- 输出：摘要从 2-3 句 → 5-8 句（+150-200%）
- 每个 Turn 增加约 300-500 tokens
- 成本增加：约 2-3 倍

**权衡**：
- ✅ 保留了重要细节
- ✅ 提高了历史记录的可用性
- ✅ 减少了信息丢失
- ⚠️ 增加了 API 成本
- ⚠️ 增加了存储空间

## 建议

1. **立即实施 Task Context 注入**
   - 成本低，收益高
   - 显著提升 LLM 对任务的理解

2. **逐步增强摘要详细程度**
   - 先从 2-3 句扩展到 4-5 句
   - 观察效果后再决定是否进一步扩展
   - 可以添加配置项让用户选择摘要详细程度

3. **考虑添加配置选项**
```typescript
export interface MemoryModuleConfig {
    // ...
    summaryDetailLevel: 'brief' | 'detailed' | 'comprehensive';
    // brief: 2-3 sentences
    // detailed: 5-8 sentences
    // comprehensive: structured summary
}
```

这样用户可以根据自己的需求和预算选择合适的摘要详细程度。
