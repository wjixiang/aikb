# RabbitMQ Service 重构文档

## 概述

本次重构将 RabbitMQService 中的核心消息操作抽象为统一接口，为后续兼容 STOMP 协议做准备。重构遵循最小改动原则，保持了原有 API 的兼容性。

## 架构设计

### 核心组件

1. **消息服务接口** (`message-service.interface.ts`)
   - 定义了统一的消息操作接口
   - 抽象了连接管理、消息发布/消费、健康检查等核心功能
   - 支持多种消息协议实现

2. **RabbitMQ 实现** (`rabbitmq-implementation.ts`)
   - 实现了消息服务接口
   - 处理所有 RabbitMQ 特定的逻辑
   - 包含连接管理、拓扑设置、重连机制等

3. **消息服务工厂** (`message-service-factory.ts`)
   - 根据协议类型创建相应的消息服务实例
   - 支持单例模式
   - 便于扩展新的协议实现

4. **重构后的 RabbitMQService** (`rabbitmq.service.ts`)
   - 使用消息服务接口，不再直接依赖 RabbitMQ 实现
   - 保持原有 API 不变，确保向后兼容
   - 通过依赖注入使用消息服务实例

### 设计优势

1. **协议无关性**: 业务逻辑与消息协议解耦，便于切换和扩展
2. **可测试性**: 可以轻松模拟消息服务进行单元测试
3. **可维护性**: 协议特定逻辑集中在实现类中
4. **可扩展性**: 新增协议支持只需实现接口即可

## 使用方式

### 基本用法（无变化）

```typescript
import { getRabbitMQService, initializeRabbitMQService } from './rabbitmq.service';

// 获取服务实例
const rabbitMQService = getRabbitMQService();

// 初始化连接
await initializeRabbitMQService();

// 发布消息
await rabbitMQService.publishPdfConversionRequest(request);

// 消费消息
const consumerTag = await rabbitMQService.consumeMessages(
  'pdf-conversion-request',
  async (message, originalMessage) => {
    // 处理消息
  }
);
```

### 直接使用消息服务接口

```typescript
import { createMessageService, MessageProtocol } from './message-service-factory';

// 创建 RabbitMQ 消息服务
const messageService = createMessageService(MessageProtocol.RABBITMQ);

// 初始化
await messageService.initialize();

// 发布消息
await messageService.publishMessage('pdf.conversion.request', message);

// 消费消息
const consumerTag = await messageService.consumeMessages(
  'pdf-conversion-request',
  async (message, originalMessage) => {
    // 处理消息
  }
);
```

## STOMP 协议支持

### 预留扩展点

重构已为 STOMP 协议支持预留了扩展点：

1. 消息服务接口已支持 STOMP 协议类型
2. 工厂模式支持创建 STOMP 实现实例
3. 提供了 STOMP 实现示例 (`stomp-implementation.example.ts`)

### 未来实现 STOMP 支持

```typescript
import { createMessageService, MessageProtocol } from './message-service-factory';

// 创建 STOMP 消息服务（未来实现）
const stompService = createMessageService(MessageProtocol.STOMP, {
  connectionOptions: {
    url: 'ws://localhost:15674/ws',
    login: 'guest',
    passcode: 'guest',
  }
});

// 使用方式与 RabbitMQ 完全相同
await stompService.initialize();
await stompService.publishMessage('/queue/pdf-conversion-request', message);
```

## 重构细节

### 接口设计

消息服务接口定义了以下核心方法：

- `initialize()`: 初始化连接
- `close()`: 关闭连接
- `isConnected()`: 检查连接状态
- `publishMessage()`: 发布消息
- `consumeMessages()`: 消费消息
- `stopConsuming()`: 停止消费
- `getQueueInfo()`: 获取队列信息
- `purgeQueue()`: 清空队列
- `healthCheck()`: 健康检查

### 兼容性保证

1. **API 兼容**: RabbitMQService 的公共方法签名保持不变
2. **行为兼容**: 所有原有功能的行为保持一致
3. **配置兼容**: 原有配置方式继续有效

### 测试验证

重构后的代码通过了所有现有测试：

- 142 个测试全部通过
- 所有消息发布和消费功能正常
- 连接管理和重连机制正常
- 健康检查功能正常

## 文件结构

```
lib/rabbitmq/
├── message-service.interface.ts      # 消息服务接口定义
├── rabbitmq-implementation.ts        # RabbitMQ 协议实现
├── message-service-factory.ts        # 消息服务工厂
├── rabbitmq.service.ts               # 重构后的 RabbitMQService
├── stomp-implementation.example.ts    # STOMP 实现示例
├── message.types.ts                  # 消息类型定义
├── rabbitmq.config.ts                # RabbitMQ 配置
└── README-REFACTORING.md             # 本文档
```

## 总结

本次重构成功地将 RabbitMQService 的核心消息操作抽象为统一接口，实现了以下目标：

1. ✅ 分离了与 RabbitMQ 服务直接对话的核心部分
2. ✅ 提供了统一的消息服务接口
3. ✅ 为后续兼容 STOMP 协议做好了准备
4. ✅ 保持了最小改动和向后兼容性
5. ✅ 通过了所有测试验证

重构后的架构更加灵活、可扩展，为未来支持多种消息协议奠定了坚实基础。