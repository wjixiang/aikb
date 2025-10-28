# Unified Queue-to-Routing-Key Mappings

## 概述

这个统一映射配置解决了 RabbitMQ 在 STOMP 和 AMQP 协议下需要重复编写队列到路由键映射的问题。通过集中管理映射配置，确保了两种协议的一致性并减少了维护成本。

## 问题背景

在之前的实现中：
- AMQP 协议直接使用队列名称和路由键
- STOMP 协议需要将队列名称转换为路由键，再转换为 STOMP 目标地址
- 两套映射逻辑分散在不同文件中，容易出现不一致

## 解决方案

### 1. 统一映射配置文件

[`queue-routing-mappings.ts`](./queue-routing-mappings.ts) 提供了：
- 集中的队列到路由键映射表
- 统一的映射查询接口
- 动态映射管理功能

### 2. 自动化映射生成

- [`message.types.ts`](./message.types.ts) 中的路由键常量现在动态生成
- [`stomp.config.ts`](./stomp.config.ts) 中的 STOMP 目标地址自动同步
- [`rabbitmq.service.ts`](./rabbitmq.service.ts) 使用统一映射进行协议转换

## 使用方法

### 添加新的队列映射

```typescript
import { addQueueRoutingMapping } from './queue-routing-mappings';

// 添加新映射
addQueueRoutingMapping('new-queue-name', 'new.routing.key');
```

### 查询映射

```typescript
import { getRoutingKeyForQueue, hasRoutingKeyMapping } from './queue-routing-mappings';

// 检查映射是否存在
if (hasRoutingKeyMapping('pdf-analysis-request')) {
  // 获取路由键
  const routingKey = getRoutingKeyForQueue('pdf-analysis-request');
  console.log(routingKey); // 'pdf.analysis.request'
}
```

### 获取所有映射

```typescript
import { getAllMappedQueueNames, getAllRoutingKeys } from './queue-routing-mappings';

const allQueues = getAllMappedQueueNames();
const allRoutingKeys = getAllRoutingKeys();
```

## 文件结构

```
lib/rabbitmq/
├── queue-routing-mappings.ts     # 统一映射配置
├── message.types.ts              # 消息类型定义（使用动态路由键）
├── stomp.config.ts               # STOMP 配置（使用动态目标地址）
├── rabbitmq.service.ts           # RabbitMQ 服务（使用统一映射）
└── README-UNIFIED-MAPPINGS.md    # 本文档
```

## 验证工具

### 1. 映射一致性验证

```bash
npx ts-node scripts/verify-unified-mappings.ts
```

验证：
- 所有标准队列都有映射
- STOMP 目标地址正确生成
- 路由键常量与映射一致
- 映射配置的整体一致性

### 2. STOMP 协议测试

```bash
npx ts-node scripts/verify-rabbitmq-stomp.ts
```

验证：
- STOMP 连接建立
- 消息发布和接收
- 队列状态监控

## 协议工作流程

### AMQP 协议
```
Queue Name → Routing Key → Exchange → Queue
```

### STOMP 协议
```
Queue Name → Routing Key (via mapping) → STOMP Destination → Exchange → Queue
```

## 优势

1. **单一数据源**：所有映射配置集中管理
2. **自动同步**：路由键和目标地址自动生成
3. **类型安全**：TypeScript 提供编译时检查
4. **易于维护**：添加新队列只需在一处配置
5. **一致性保证**：避免协议间的不一致问题

## 迁移指南

### 从旧版本迁移

1. 确保所有队列都在 `QUEUE_TO_ROUTING_KEY_MAP` 中有映射
2. 移除硬编码的 switch 语句
3. 使用 `getRoutingKeyForQueue()` 替换直接映射
4. 运行验证脚本确保一致性

### 添加新队列

1. 在 `queue-routing-mappings.ts` 中添加映射
2. 运行验证脚本检查一致性
3. 无需修改其他文件，自动同步

## 故障排除

### 常见问题

1. **映射不存在错误**
   ```
   Error: No routing key mapping found for queue: xxx
   ```
   解决：在 `QUEUE_TO_ROUTING_KEY_MAP` 中添加相应映射

2. **STOMP 消息未被消费**
   - 检查队列映射是否正确
   - 运行验证脚本确认一致性
   - 查看日志确认订阅目标地址

3. **路由键不一致**
   - 运行 `verify-unified-mappings.ts` 检查
   - 确保常量使用动态生成的路由键

## 最佳实践

1. **始终使用映射函数**：避免硬编码路由键
2. **定期运行验证**：确保配置一致性
3. **文档化新队列**：在添加映射时更新文档
4. **测试两种协议**：确保 AMQP 和 STOMP 都能正常工作

## 未来改进

1. **自动发现**：自动扫描队列并生成映射
2. **配置文件**：支持外部配置文件
3. **监控集成**：添加映射使用情况监控
4. **热重载**：支持运行时更新映射配置