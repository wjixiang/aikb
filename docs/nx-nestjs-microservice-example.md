# Nx NestJS微服务创建示例

本示例将展示如何使用Nx命令创建一个新的NestJS微服务，并提供一个简化的代码模板。

## 步骤1：使用Nx生成器创建应用

首先，使用Nx的NestJS应用生成器创建新的微服务：

```bash
# 创建一个新的NestJS应用
npx nx g @nx/nest:app notification-service --directory=apps/notification-service

# 或者创建一个微服务特定的应用
npx nx g @nx/nest:app notification-service --directory=apps/notification-service --style=scss --routing=false
```

## 步骤2：安装必要的依赖

```bash
# 安装NestJS微服务相关依赖
pnpm add --filter=notification-service @nestjs/microservices @nestjs/common @nestjs/core

# 安装项目共享依赖
pnpm add --filter=notification-service @aikb/rabbitmq @aikb/log-management
```

## 步骤3：创建微服务结构

创建以下目录结构：

```bash
mkdir -p apps/notification-service/src/notification
mkdir -p apps/notification-service/src/interfaces
mkdir -p apps/notification-service/src/config
```

## 步骤4：实现微服务代码

### 1. 主入口文件 (main.ts)

```typescript
import { config } from 'dotenv';
import { NestFactory } from '@nestjs/core';
import { Transport, MicroserviceOptions } from '@nestjs/microservices';
import { AppModule } from './app.module';
import createLoggerWithPrefix from '@aikb/log-management/logger';

// Load environment variables
config();

const logger = createLoggerWithPrefix('NotificationService');

async function bootstrap() {
  try {
    // Create HTTP server for health checks and monitoring
    const app = await NestFactory.create(AppModule, {
      logger: ['error', 'warn', 'log', 'debug', 'verbose'],
    });

    // Create microservice
    const microservice = app.connectMicroservice<MicroserviceOptions>({
      transport: Transport.RMQ,
      options: {
        urls: [process.env.RABBITMQ_URL || 'amqp://localhost:5672'],
        queue: process.env.RABBITMQ_QUEUE || 'notification-service-queue',
        queueOptions: {
          durable: true,
        },
        prefetchCount: 1,
        noAck: false,
      },
    });

    // Start both HTTP server and microservice
    await app.startAllMicroservices();
    
    const port = process.env.PORT || 3001;
    await app.listen(port);
    
    logger.log(`Notification service is running on port ${port}`);
    logger.log(`Microservice is listening to RabbitMQ queue: ${process.env.RABBITMQ_QUEUE || 'notification-service-queue'}`);
  } catch (error) {
    logger.error('Failed to start notification service:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

bootstrap();
```

### 2. 应用模块 (app.module.ts)

```typescript
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { NotificationModule } from './notification/notification.module';

@Module({
  imports: [
    NotificationModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

### 3. 通知模块 (notification.module.ts)

```typescript
import { Module } from '@nestjs/common';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';

@Module({
  controllers: [NotificationController],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}
```

### 4. 通知控制器 (notification.controller.ts)

```typescript
import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { NotificationService } from './notification.service';
import { NotificationMessage } from '../interfaces/notification-message.interface';

@Controller()
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @EventPattern('notification.send')
  async handleSendNotification(@Payload() data: NotificationMessage) {
    return this.notificationService.sendNotification(data);
  }

  @EventPattern('notification.batch')
  async handleBatchNotifications(@Payload() data: NotificationMessage[]) {
    return this.notificationService.sendBatchNotifications(data);
  }
}
```

### 5. 通知服务 (notification.service.ts)

```typescript
import { Injectable } from '@nestjs/common';
import createLoggerWithPrefix from '@aikb/log-management/logger';
import { NotificationMessage } from '../interfaces/notification-message.interface';

const logger = createLoggerWithPrefix('NotificationService');

@Injectable()
export class NotificationService {
  async sendNotification(data: NotificationMessage): Promise<any> {
    try {
      logger.info(`Sending notification: ${JSON.stringify(data)}`);
      
      // Your notification logic here
      // For example: send email, push notification, SMS, etc.
      
      logger.info('Notification sent successfully');
      return { success: true, message: 'Notification sent successfully' };
    } catch (error) {
      logger.error('Error sending notification:', error);
      throw error;
    }
  }

  async sendBatchNotifications(messages: NotificationMessage[]): Promise<any> {
    try {
      logger.info(`Sending batch notifications: ${messages.length} messages`);
      
      // Process each notification
      const results = await Promise.allSettled(
        messages.map(message => this.sendNotification(message))
      );
      
      const successful = results.filter(result => result.status === 'fulfilled').length;
      const failed = results.filter(result => result.status === 'rejected').length;
      
      logger.info(`Batch notifications completed: ${successful} successful, ${failed} failed`);
      
      return { 
        success: true, 
        message: 'Batch notifications processed',
        successful,
        failed,
        total: messages.length
      };
    } catch (error) {
      logger.error('Error sending batch notifications:', error);
      throw error;
    }
  }
}
```

### 6. 消息接口 (notification-message.interface.ts)

```typescript
export interface NotificationMessage {
  id: string;
  recipient: string;
  subject: string;
  content: string;
  type: 'email' | 'sms' | 'push';
  priority: 'low' | 'medium' | 'high';
  timestamp: Date;
  metadata?: Record<string, any>;
}
```

### 7. 应用控制器 (app.controller.ts)

```typescript
import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  getHealth(): object {
    return this.appService.getHealth();
  }
}
```

### 8. 应用服务 (app.service.ts)

```typescript
import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Notification Service is running!';
  }

  getHealth(): object {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'notification-service',
    };
  }
}
```

## 步骤5：配置文件

### 1. 环境配置 (.env)

```env
# RabbitMQ Configuration
RABBITMQ_URL=amqp://localhost:5672
RABBITMQ_QUEUE=notification-service-queue

# Server Configuration
PORT=3001

# Logging
LOG_LEVEL=info
```

### 2. 更新 package.json

```json
{
  "name": "notification-service",
  "version": "1.0.0",
  "description": "Notification microservice for sending emails, SMS, and push notifications",
  "main": "./src/main.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "start": "node dist/main.js",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "keywords": [
    "nestjs",
    "microservice",
    "notification",
    "rabbitmq",
    "messaging"
  ],
  "author": "",
  "license": "UNLICENSED",
  "dependencies": {
    "@nestjs/common": "^10.0.0",
    "@nestjs/core": "^10.0.0",
    "@nestjs/microservices": "^10.0.0",
    "@nestjs/platform-express": "^10.0.0",
    "@aikb/rabbitmq": "workspace:*",
    "@aikb/log-management": "workspace:*",
    "dotenv": "^17.2.2",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.1"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.0.0",
    "@nestjs/schematics": "^10.0.0",
    "@nestjs/testing": "^10.0.0",
    "@types/node": "^22.10.7",
    "typescript": "^5.7.3",
    "vitest": "^3.2.4"
  }
}
```

## 步骤6：运行和测试

### 1. 构建应用

```bash
# 构建应用
nx build notification-service

# 或者使用开发模式
nx serve notification-service
```

### 2. 测试应用

```bash
# 运行测试
nx test notification-service

# 运行测试并生成覆盖率报告
nx test notification-service --coverage
```

### 3. 发送测试消息

创建一个简单的测试脚本来发送消息到RabbitMQ队列：

```typescript
// test-notification.ts
import { connect } from 'amqplib';

async function sendTestNotification() {
  try {
    const connection = await connect('amqp://localhost:5672');
    const channel = await connection.createChannel();
    
    const queue = 'notification-service-queue';
    await channel.assertQueue(queue, { durable: true });
    
    const message = {
      id: 'test-notification-123',
      recipient: 'test@example.com',
      subject: 'Test Notification',
      content: 'This is a test notification from the notification service',
      type: 'email',
      priority: 'medium',
      timestamp: new Date(),
      metadata: {
        source: 'test-script',
        version: '1.0.0'
      }
    };
    
    channel.sendToQueue(queue, Buffer.from(JSON.stringify(message)), { persistent: true });
    console.log('Test notification sent:', message);
    
    await channel.close();
    await connection.close();
  } catch (error) {
    console.error('Error sending test notification:', error);
  }
}

sendTestNotification();
```

运行测试脚本：

```bash
npx tsx test-notification.ts
```

## 步骤7：部署配置

### 1. Dockerfile

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY dist/ ./dist/

EXPOSE 3001

CMD ["node", "dist/main.js"]
```

### 2. Docker Compose

```yaml
version: '3.8'

services:
  rabbitmq:
    image: rabbitmq:3-management
    ports:
      - "5672:5672"
      - "15672:15672"
    environment:
      RABBITMQ_DEFAULT_USER: admin
      RABBITMQ_DEFAULT_PASS: password

  notification-service:
    build: .
    ports:
      - "3001:3001"
    environment:
      RABBITMQ_URL: amqp://admin:password@rabbitmq:5672
      RABBITMQ_QUEUE: notification-service-queue
      PORT: 3001
      LOG_LEVEL: info
    depends_on:
      - rabbitmq
```

## 总结

通过这个示例，您应该能够：

1. 使用Nx生成器创建新的NestJS微服务
2. 实现基本的微服务功能（控制器、服务等）
3. 配置RabbitMQ消息传递
4. 编写和运行测试
5. 部署微服务

这个示例提供了一个基础模板，您可以根据具体需求进行扩展和定制。