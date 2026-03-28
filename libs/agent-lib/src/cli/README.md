# Agent CLI - 多Agent框架命令行工具

## 概述

`agent-cli` 是多 Agent 框架的统一命令行工具，用于测试、监控和管理 Agent 运行时。

## 架构

```
agent-cli/
├── index.ts           # 主入口，命令定义
├── commands/          # 命令实现
│   ├── runtime.ts     # Runtime 管理命令
│   ├── agent.ts       # Agent 管理命令
│   ├── test.ts        # 测试场景命令
│   ├── monitor.ts     # 监控命令
│   └── a2a.ts         # A2A 通信测试命令
├── lib/               # 工具库
│   ├── logger.ts      # 日志工具
│   ├── formatter.ts   # 输出格式化
│   ├── config.ts      # 配置加载
│   └── monitor.ts     # 监控逻辑
└── scenarios/         # 测试场景定义
    ├── basic.ts       # 基础测试场景
    ├── a2a.ts         # A2A 通信测试场景
    └── redis.ts       # Redis 分布式测试场景
```

## 命令结构

```
agent-cli <command> [subcommand] [options]
```

### 全局选项

| 选项                  | 简写 | 描述                             | 默认值         |
| --------------------- | ---- | -------------------------------- | -------------- |
| `--config <file>`     | `-c` | 配置文件路径                     | `.agent-clirc` |
| `--log-level <level>` | `-l` | 日志级别 (debug/info/warn/error) | `info`         |
| `--output <format>`   | `-o` | 输出格式 (json/table/compact)    | `table`        |
| `--no-color`          |      | 禁用彩色输出                     | false          |
| `--verbose`           | `-v` | 详细输出                         | false          |
| `--help`              | `-h` | 显示帮助                         |                |
| `--version`           | `-V` | 显示版本                         |                |

---

## 命令详细说明

### 1. runtime - Runtime 管理

管理 Agent Runtime 实例。

```bash
agent-cli runtime <action> [options]
```

#### 1.1 runtime start - 启动 Runtime

```bash
agent-cli runtime start [options]
```

| 选项                   | 描述                           | 默认值               |
| ---------------------- | ------------------------------ | -------------------- |
| `--max-agents <n>`     | 最大 Agent 数量                | 10                   |
| `--message-bus <mode>` | MessageBus 模式 (memory/redis) | memory               |
| `--redis-url <url>`    | Redis 连接 URL (redis模式必需) |                      |
| `--api-key <key>`      | API 密钥                       | $OPENAI_API_KEY      |
| `--api-url <url>`      | API 基础 URL                   |                      |
| `--api-model <model>`  | 模型 ID                        |                      |
| `--detach`             | 后台运行                       | false                |
| `--pid-file <file>`    | PID 文件路径                   | `.agent-runtime.pid` |

**示例：**

```bash
# 内存模式启动
agent-cli runtime start

# Redis 模式启动
agent-cli runtime start --message-bus redis --redis-url redis://localhost:6379

# 后台运行
agent-cli runtime start --detach
```

#### 1.2 runtime stop - 停止 Runtime

```bash
agent-cli runtime stop [options]
```

| 选项                | 描述         | 默认值               |
| ------------------- | ------------ | -------------------- |
| `--pid-file <file>` | PID 文件路径 | `.agent-runtime.pid` |
| `--force`           | 强制停止     | false                |

#### 1.3 runtime status - 查看状态

```bash
agent-cli runtime status [options]
```

输出示例：

```
┌─────────────────────────────────────────────────────────────┐
│                     Agent Runtime Status                     │
├─────────────────────────────────────────────────────────────┤
│ Status        │ Running                                      │
│ PID           │ 12345                                        │
│ Uptime        │ 00:15:32                                     │
│ MessageBus    │ memory                                       │
│ Max Agents    │ 10                                           │
├─────────────────────────────────────────────────────────────┤
│ Agents        │ 6 total                                      │
│   ├─ Running │ 4                                            │
│   ├─ Idle    │ 2                                            │
│   ├─ Stopped │ 0                                            │
│   └─ Error   │ 0                                            │
└─────────────────────────────────────────────────────────────┘
```

---

### 2. agent - Agent 管理

管理 Runtime 中的 Agent 实例。

```bash
agent-cli agent <action> [options]
```

#### 2.1 agent list - 列出 Agent

```bash
agent-cli agent list [options]
```

| 选项                | 描述                                  | 默认值 |
| ------------------- | ------------------------------------- | ------ |
| `--status <status>` | 过滤状态 (running/idle/stopped/error) |        |
| `--type <type>`     | 过滤类型                              |        |
| `--format <format>` | 输出格式 (table/json/compact)         | table  |

**输出示例：**

```
┌──────────────────┬──────────────┬────────────┬─────────┬────────────────┐
│ Instance ID      │ Name         │ Type       │ Status  │ Created At     │
├──────────────────┼──────────────┼────────────┼─────────┼────────────────┤
│ agent-abc123     │ Epidemiology │ literature  │ running │ 00:05:23 ago   │
│ agent-def456     │ Diagnosis    │ literature  │ idle    │ 00:05:21 ago   │
│ agent-ghi789     │ Management   │ literature  │ running │ 00:05:19 ago   │
└──────────────────┴──────────────┴────────────┴─────────┴────────────────┘
```

#### 2.2 agent create - 创建 Agent

```bash
agent-cli agent create <type> [options]
```

| 参数/选项       | 描述         | 默认值 |
| --------------- | ------------ | ------ |
| `type`          | Agent 类型   |        |
| `--name <name>` | Agent 名称   |        |
| `--sop <file>`  | SOP 文件路径 |        |
| `--auto-start`  | 自动启动     | false  |

**支持的 Agent 类型：**

- `epidemiology` - 流行病学文献检索
- `pathophysiology` - 病理机制文献检索
- `diagnosis` - 诊断文献检索
- `management` - 治疗管理文献检索
- `quality-of-life` - 生活质量文献检索
- `emerging-treatments` - 新兴疗法文献检索
- `router` - 路由 Agent

#### 2.3 agent start - 启动 Agent

```bash
agent-cli agent start <instance-id>
```

#### 2.4 agent stop - 停止 Agent

```bash
agent-cli agent stop <instance-id> [options]
```

| 选项      | 描述     | 默认值 |
| --------- | -------- | ------ |
| `--force` | 强制停止 | false  |

#### 2.5 agent destroy - 销毁 Agent

```bash
agent-cli agent destroy <instance-id> [options]
```

| 选项        | 描述             | 默认值 |
| ----------- | ---------------- | ------ |
| `--cascade` | 级联销毁子 Agent | false  |

#### 2.6 agent logs - 查看 Agent 日志

```bash
agent-cli agent logs <instance-id> [options]
```

| 选项                 | 描述          | 默认值 |
| -------------------- | ------------- | ------ |
| `--follow`           | 持续跟踪日志  | false  |
| `--tail <n>`         | 显示最后 n 行 | 50     |
| `--filter <pattern>` | 过滤日志内容  |        |

---

### 3. test - 测试场景

运行预定义的测试场景。

```bash
agent-cli test <scenario> [options]
```

#### 3.1 test basic - 基础功能测试

```bash
agent-cli test basic [options]
```

测试内容：

- 创建 Runtime
- 创建多个 Agent
- Agent 生命周期管理
- 基础通信

| 选项                   | 描述              | 默认值 |
| ---------------------- | ----------------- | ------ |
| `--agent-count <n>`    | 创建的 Agent 数量 | 3      |
| `--parallel`           | 并行创建 Agent    | false  |
| `--duration <seconds>` | 测试持续时间      | 60     |

#### 3.2 test a2a - A2A 通信测试

```bash
agent-cli test a2a [options]
```

测试内容：

- A2A Task 发送
- A2A Query 发送
- A2A Event 发送
- ACK 确认机制
- 结果等待

| 选项                   | 描述            | 默认值 |
| ---------------------- | --------------- | ------ |
| `--message-bus <mode>` | MessageBus 模式 | memory |
| `--redis-url <url>`    | Redis URL       |        |
| `--task-count <n>`     | 发送任务数量    | 5      |
| `--timeout <ms>`       | 超时时间        | 30000  |

#### 3.3 test redis - Redis 分布式测试

```bash
agent-cli test redis [options]
```

测试内容：

- Redis pub/sub 通信
- 跨进程 Agent 通信
- 分布式场景

| 选项                      | 描述                     | 默认值                 |
| ------------------------- | ------------------------ | ---------------------- |
| `--redis-url <url>`       | Redis URL                | redis://localhost:6379 |
| `--runtime-count <n>`     | Runtime 数量             | 2                      |
| `--agent-per-runtime <n>` | 每个 Runtime 的 Agent 数 | 2                      |

#### 3.4 test scenario - 运行自定义场景

```bash
agent-cli test scenario <file> [options]
```

运行自定义的测试场景 JSON/YAML 文件。

#### 3.5 test list - 列出测试场景

```bash
agent-cli test list
```

---

### 4. monitor - 监控

实时监控 Agent 和 Runtime 状态。

```bash
agent-cli monitor <target> [options]
```

#### 4.1 monitor runtime - 监控 Runtime

```bash
agent-cli monitor runtime [options]
```

显示：Runtime 状态、Agent 列表、统计信息

| 选项             | 描述     | 默认值 |
| ---------------- | -------- | ------ |
| `--refresh <ms>` | 刷新间隔 | 1000   |
| `--compact`      | 紧凑模式 | false  |

**输出示例：**

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       Agent Runtime Monitor                              │
│                        [Refresh: 1s | Ctrl+C to exit]                    │
├─────────────────────────────────────────────────────────────────────────┤
│ Runtime Status                                                                 │
│ ├─ Status:    Running                                                    │
│ ├─ Uptime:    00:15:32                                                   │
│ ├─ MessageBus: memory                                                     │
│ └─ Agents:    6/10                                                        │
│                                                                          │
│ Agents (6)                                                               │
│ ┌──────────────────┬────────────┬─────────┬────────┬──────────────────┐   │
│ │ Name             │ Type       │ Status  │ Tasks  │ Last Activity    │   │
│ ├──────────────────┼────────────┼─────────┼────────┼──────────────────┤   │
│ │ Epidemiology     │ literature │ running │ 12     │ 5s ago           │   │
│ │ Diagnosis        │ literature │ idle    │ 8      │ 12s ago          │   │
│ │ Management       │ literature │ running │ 15     │ 2s ago           │   │
│ └──────────────────┴────────────┴─────────┴────────┴──────────────────┘   │
│                                                                          │
│ Statistics                                                              │
│ ├─ Total Tasks:     235                                                  │
│ ├─ Completed:       220 (93.6%)                                          │
│ ├─ Failed:          10 (4.3%)                                            │
│ ├─ Pending:         5 (2.1%)                                             │
│ └─ Avg Duration:    2.3s                                                 │
└─────────────────────────────────────────────────────────────────────────┘
```

#### 4.2 monitor agent - 监控单个 Agent

```bash
agent-cli monitor agent <instance-id> [options]
```

显示：Agent 状态、任务队列、A2A 消息

| 选项             | 描述          | 默认值 |
| ---------------- | ------------- | ------ |
| `--refresh <ms>` | 刷新间隔      | 500    |
| `--show-tasks`   | 显示任务详情  | true   |
| `--show-a2a`     | 显示 A2A 消息 | true   |

#### 4.3 monitor a2a - 监控 A2A 通信

```bash
agent-cli monitor a2a [options]
```

显示：活跃会话、消息流、统计信息

| 选项                 | 描述                         | 默认值 |
| -------------------- | ---------------------------- | ------ |
| `--refresh <ms>`     | 刷新间隔                     | 500    |
| `--follow <conv-id>` | 跟踪特定会话                 |        |
| `--show-all`         | 显示所有消息（包括已完成的） | false  |

#### 4.4 monitor logs - 监控日志

```bash
agent-cli monitor logs [options]
```

实时显示所有 Agent 日志。

| 选项                  | 描述         | 默认值 |
| --------------------- | ------------ | ------ |
| `--level <level>`     | 日志级别过滤 | info   |
| `--agent <id>`        | 特定 Agent   |        |
| `--pattern <pattern>` | 正则过滤     |        |

---

### 5. a2a - A2A 通信测试

专门用于 A2A 通信的测试命令。

```bash
agent-cli a2a <action> [options]
```

#### 5.1 a2a send-task - 发送任务

```bash
agent-cli a2a send-task <target-agent> <description> [options]
```

| 选项             | 描述                            | 默认值 |
| ---------------- | ------------------------------- | ------ |
| `--task-id <id>` | 任务 ID                         | auto   |
| `--input <json>` | 输入数据 (JSON)                 | {}     |
| `--priority <p>` | 优先级 (low/normal/high/urgent) | normal |
| `--timeout <ms>` | 超时时间                        | 60000  |

**示例：**

```bash
agent-cli a2a send-task agent-abc123 "Search PubMed for LDH" \
  --input '{"query":"lumbar disc herniation","limit":10}' \
  --priority high
```

#### 5.2 a2a send-query - 发送查询

```bash
agent-cli a2a send-query <target-agent> <query> [options]
```

#### 5.2 a2a send-event - 发送事件

```bash
agent-cli a2a send-event <target-agent> <event-type> [options]
```

| 选项            | 描述            | 默认值 |
| --------------- | --------------- | ------ |
| `--data <json>` | 事件数据 (JSON) | {}     |

#### 5.3 a2a conversations - 查看会话

```bash
agent-cli a2a conversations [options]
```

| 选项                | 描述       | 默认值 |
| ------------------- | ---------- | ------ |
| `--status <status>` | 过滤状态   |        |
| `--active-only`     | 仅活跃会话 | false  |

---

## 配置文件

配置文件支持 `.agent-clirc` (JSON/YAML) 或 `agent-cli.config.js`。

**示例配置：**

```yaml
# .agent-clirc
runtime:
  maxAgents: 10
  messageBus: memory
  # redis:
  #   url: redis://localhost:6379

api:
  provider: openai
  apiKey: ${OPENAI_API_KEY}
  baseUrl: https://api.openai.com/v1
  model: gpt-4

agent:
  defaultType: router
  autoStart: false

monitor:
  refreshInterval: 1000
  compact: false

log:
  level: info
  format: pretty # pretty | json
```

---

## 环境变量

| 变量               | 描述           |
| ------------------ | -------------- |
| `AGENT_CLI_CONFIG` | 配置文件路径   |
| `OPENAI_API_KEY`   | API 密钥       |
| `REDIS_URL`        | Redis 连接 URL |
| `LOG_LEVEL`        | 日志级别       |

---

## 输出格式

### table (默认)

表格格式，适合终端查看

### json

JSON 格式，便于脚本解析

### compact

紧凑格式，减少输出

---

## 退出码

| 码  | 含义           |
| --- | -------------- |
| 0   | 成功           |
| 1   | 一般错误       |
| 2   | 无效参数       |
| 3   | Runtime 未运行 |
| 4   | Agent 未找到   |
| 5   | 超时           |
| 6   | 测试失败       |
