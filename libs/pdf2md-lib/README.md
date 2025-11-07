# PDF2MD Library

这个库提供了 PDF 转 Markdown 相关的共用功能，包括微服务客户端模块。

## 微服务客户端模块

### 概述

`MicroserviceClientModule` 提供了一个统一的方式来注册和管理 NestJS 微服务客户端，避免在各个服务中重复配置 RabbitMQ 连接。

### 特性

- 🔄 **配置集中管理**：所有 RabbitMQ 连接配置在一个地方
- 🌍 **环境感知**：自动使用环境变量中的 RabbitMQ 配置
- 🛡️ **类型安全**：TypeScript 支持，避免配置错误
- 🚀 **易于使用**：提供预定义的服务配置和便捷方法
- 🔧 **高度可配置**：支持自定义连接参数

### 安装

```bash
npm install @aikb/pdf2md-lib
```

### 基本用法

#### 1. 注册单个微服务客户端

```typescript
import { Module } from '@nestjs/common';
import { MicroserviceClientModule, MICROSERVICE_CLIENTS } from '@aikb/pdf2md-lib';

@Module({
  imports: [
    MicroserviceClientModule.register(MICROSERVICE_CLIENTS.PDF_2_MARKDOWN_SERVICE),
  ],
})
export class AppModule {}
```

#### 2. 注册多个微服务客户端

```typescript
@Module({
  imports: [
    MicroserviceClientModule.registerAsync([
      MICROSERVICE_CLIENTS.PDF_2_MARKDOWN_SERVICE,
      MICROSERVICE_CLIENTS.BIBLIOGRAPHY_SERVICE,
    ]),
  ],
})
export class AppModule {}
```

#### 3. 使用便捷方法

```typescript
// 注册常用客户端
@Module({
  imports: [
    registerCommonMicroserviceClients(),
  ],
})
export class AppModule {}

// 或者注册所有预定义客户端
@Module({
  imports: [
    registerAllMicroserviceClients(),
  ],
})
export class AppModule {}
```

#### 4. 自定义配置

```typescript
@Module({
  imports: [
    MicroserviceClientModule.register({
      name: 'CUSTOM_SERVICE',
      queue: 'custom_queue',
      connectionInitOptions: { timeout: 60000 },
      heartbeat: 120,
      prefetchCount: 5,
    }),
  ],
})
export class AppModule {}
```

### 在服务中使用客户端

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

@Injectable()
export class MyService {
  constructor(
    @Inject('PDF_2_MARKDOWN_SERVICE') private pdf2mdClient: ClientProxy,
    @Inject('BIBLIOGRAPHY_SERVICE') private bibliographyClient: ClientProxy,
  ) {}

  async sendPdfConversionRequest(data: any) {
    // 发送消息（不等待响应）
    return this.pdf2mdClient.emit('pdf-2-markdown-conversion', data);
  }

  async sendPdfConversionRequestWithResponse(data: any) {
    // 发送消息并等待响应
    return this.pdf2mdClient.send('pdf-2-markdown-conversion', data).toPromise();
  }
}
```

### 预定义的服务配置

库中预定义了以下微服务客户端配置：

- `PDF_2_MARKDOWN_SERVICE`: PDF 转 Markdown 服务
- `BIBLIOGRAPHY_SERVICE`: 文献管理服务
- `PDF_ANALYSIS_SERVICE`: PDF 分析服务
- `CHUNKING_EMBEDDING_SERVICE`: 分块嵌入服务

### 环境变量

微服务客户端会自动读取以下环境变量：

- `RABBITMQ_USERNAME`: RabbitMQ 用户名
- `RABBITMQ_PASSWORD`: RabbitMQ 密码
- `RABBITMQ_HOSTNAME`: RabbitMQ 主机名
- `RABBITMQ_AMQP_PORT`: RabbitMQ AMQP 端口
- `RABBITMQ_VHOST`: RabbitMQ 虚拟主机
- `RABBITMQ_QUEUE`: 默认队列名称（可选）

### 迁移指南

如果您现有的服务中使用了直接的 `ClientsModule.register` 配置，可以按以下步骤迁移：

#### 之前：

```typescript
// apps/bibliography-service/src/app/app.module.ts
@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'PDF_2_MARKDOWN_SERVICE',
        transport: Transport.RMQ,
        options: {
          urls: [
            `amqp://${process.env['RABBITMQ_USERNAME']}:${process.env['RABBITMQ_PASSWORD']}@${process.env['RABBITMQ_HOSTNAME']}:${process.env['RABBITMQ_AMQP_PORT']}/${process.env['RABBITMQ_VHOST']}`,
          ],
          queue: process.env['RABBITMQ_QUEUE'] || 'pdf_2_markdown_queue',
          connectionInitOptions: { timeout: 30000 },
          heartbeat: 60,
          prefetchCount: 1,
        },
      },
    ]),
  ],
})
export class AppModule {}
```

#### 之后：

```typescript
// apps/bibliography-service/src/app/app.module.ts
import { MicroserviceClientModule, MICROSERVICE_CLIENTS } from '@aikb/pdf2md-lib';

@Module({
  imports: [
    MicroserviceClientModule.register(MICROSERVICE_CLIENTS.PDF_2_MARKDOWN_SERVICE),
  ],
})
export class AppModule {}
```

### API 参考

#### MicroserviceClientModule

##### `register(config: MicroserviceClientConfig): DynamicModule`

注册单个微服务客户端。

**参数：**
- `config`: 客户端配置对象

##### `registerAsync(configs: MicroserviceClientConfig[]): DynamicModule`

注册多个微服务客户端。

**参数：**
- `configs`: 客户端配置数组

#### MicroserviceClientConfig

```typescript
interface MicroserviceClientConfig {
  name: string;
  queue?: string;
  connectionInitOptions?: { timeout: number };
  heartbeat?: number;
  prefetchCount?: number;
}
```

#### 便捷函数

- `registerCommonMicroserviceClients()`: 注册常用客户端
- `registerAllMicroserviceClients()`: 注册所有预定义客户端

### 贡献

欢迎提交 Issue 和 Pull Request 来改进这个库！

### 许可证

MIT License
