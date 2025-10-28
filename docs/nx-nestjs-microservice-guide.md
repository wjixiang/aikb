# 在Nx Monorepo中创建NestJS微服务指南

本指南将详细介绍如何在Nx管理的monorepo项目中创建一个新的NestJS微服务。

## 目录

1. [项目结构概述](#项目结构概述)
2. [创建新的NestJS微服务](#创建新的nestjs微服务)
3. [配置项目依赖](#配置项目依赖)
4. [实现微服务核心功能](#实现微服务核心功能)
5. [配置构建和部署脚本](#配置构建和部署脚本)
6. [测试微服务](#测试微服务)
7. [最佳实践](#最佳实践)

## 项目结构概述

在当前的Nx monorepo中，微服务位于`apps/`目录下，按功能分组组织：

```
apps/
├── pdf-process/
│   ├── pdf-analysis-worker/
│   ├── pdf-conversion-worker/
│   └── markdown-storage-worker/
└── web-frontend/
```

每个微服务都有自己的`package.json`、`tsconfig.json`和`project.json`文件，用于管理依赖、TypeScript配置和Nx构建目标。

## 创建新的NestJS微服务

### 1. 使用Nx生成器创建应用

首先，使用Nx的NestJS应用生成器创建新的微服务：

```bash
# 创建一个新的NestJS应用
npx nx g @nx/nest:app your-microservice-name

# 或者创建一个微服务特定的应用
npx nx g @nx/nest:app your-microservice-name --directory=apps/your-domain/your-microservice-name
```

### 2. 手动创建微服务结构

如果需要更精细的控制，可以手动创建目录结构：

```bash
# 创建微服务目录
mkdir -p apps/your-domain/your-microservice-name/src

# 创建必要的配置文件
touch apps/your-domain/your-microservice-name/package.json
touch apps/your-domain/your-microservice-name/tsconfig.json
touch apps/your-domain/your-microservice-name/project.json
touch apps/your-domain/your-microservice-name/src/main.ts
```

## 配置项目依赖

### 1. package.json 配置

创建`apps/your-domain/your-microservice-name/package.json`文件：

```json
{
  "name": "your-microservice-name",
  "version": "1.0.0",
  "description": "Description of your microservice",
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

### 2. tsconfig.json 配置

创建`apps/your-domain/your-microservice-name/tsconfig.json`文件：

```json
{
  "extends": "../../../tsconfig.base.json",
  "files": [],
  "include": [],
  "references": [
    {
      "path": "./tsconfig.app.json"
    },
    {
      "path": "./tsconfig.spec.json"
    }
  ],
  "compilerOptions": {
    "forceConsistentCasingInFileNames": true,
    "strict": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

创建`apps/your-domain/your-microservice-name/tsconfig.app.json`文件：

```json
{
  "extends": "./tsconfig.json",
  "compileOnSave": false,
  "compilerOptions": {
    "outDir": "../../dist/out-tsc",
    "assets": ["*.json"],
    "types": ["node"]
  },
  "include": ["src/**/*.ts"],
  "exclude": ["jest.config.ts", "src/**/*.spec.ts", "src/**/*.test.ts"]
}
```

### 3. project.json 配置

创建`apps/your-domain/your-microservice-name/project.json`文件：

```json
{
  "name": "your-microservice-name",
  "$schema": "../../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "apps/your-domain/your-microservice-name/src",
  "projectType": "application",
  "targets": {
    "build": {
      "executor": "@nx/js:tsc",
      "outputs": ["{options.outputPath}"],
      "options": {
        "outputPath": "apps/your-domain/your-microservice-name/dist",
        "main": "apps/your-domain/your-microservice-name/src/main.ts",
        "tsConfig": "apps/your-domain/your-microservice-name/tsconfig.app.json",
        "assets": ["apps/your-domain/your-microservice-name/*.json"]
      }
    },
    "serve": {
      "executor": "@nx/node:execute",
      "options": {
        "buildTarget": "your-microservice-name:build"
      },
      "configurations": {
        "production": {
          "buildTarget": "your-microservice-name:build:production"
        }
      }
    },
    "test": {
      "executor": "@nx/vite:test",
      "outputs": ["{workspaceRoot}/coverage/{projectRoot}"],
      "options": {
        "passWithNoTests": true,
        "reportsDirectory": "../../coverage/apps/your-domain/your-microservice-name"
      }
    },
    "lint": {
      "executor": "@nx/linter:eslint",
      "outputs": ["{options.outputFile}"],
      "options": {
        "lintFilePatterns": ["apps/your-domain/your-microservice-name/**/*.ts"]
      }
    }
  },
  "tags": []
}
```

## 实现微服务核心功能

### 1. 主入口文件 (main.ts)

创建`apps/your-domain/your-microservice-name/src/main.ts`文件：

```typescript
import { config } from 'dotenv';
import { NestFactory } from '@nestjs/core';
import { Transport, MicroserviceOptions } from '@nestjs/microservices';
import { AppModule } from './app.module';
import createLoggerWithPrefix from '@aikb/log-management/logger';

// Load environment variables
config();

const logger = createLoggerWithPrefix('YourMicroserviceName');

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
        queue: process.env.RABBITMQ_QUEUE || 'your-microservice-queue',
        queueOptions: {
          durable: true,
        },
        prefetchCount: 1,
        noAck: false,
      },
    });

    // Start both HTTP server and microservice
    await app.startAllMicroservices();
    
    const port = process.env.PORT || 3000;
    await app.listen(port);
    
    logger.log(`Your microservice is running on port ${port}`);
    logger.log(`Microservice is listening to RabbitMQ queue: ${process.env.RABBITMQ_QUEUE || 'your-microservice-queue'}`);
  } catch (error) {
    logger.error('Failed to start microservice:', error);
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

创建`apps/your-domain/your-microservice-name/src/app.module.ts`文件：

```typescript
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { YourMicroserviceModule } from './your-microservice/your-microservice.module';

@Module({
  imports: [
    YourMicroserviceModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

### 3. 微服务模块

创建`apps/your-domain/your-microservice-name/src/your-microservice/your-microservice.module.ts`文件：

```typescript
import { Module } from '@nestjs/common';
import { YourMicroserviceController } from './your-microservice.controller';
import { YourMicroserviceService } from './your-microservice.service';

@Module({
  controllers: [YourMicroserviceController],
  providers: [YourMicroserviceService],
  exports: [YourMicroserviceService],
})
export class YourMicroserviceModule {}
```

### 4. 微服务控制器

创建`apps/your-domain/your-microservice-name/src/your-microservice/your-microservice.controller.ts`文件：

```typescript
import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { YourMicroserviceService } from './your-microservice.service';
import { YourMessagePattern } from './interfaces/message-pattern.interface';

@Controller()
export class YourMicroserviceController {
  constructor(private readonly yourMicroserviceService: YourMicroserviceService) {}

  @EventPattern('your.message.pattern')
  async handleYourMessage(@Payload() data: YourMessagePattern) {
    return this.yourMicroserviceService.processMessage(data);
  }
}
```

### 5. 微服务服务

创建`apps/your-domain/your-microservice-name/src/your-microservice/your-microservice.service.ts`文件：

```typescript
import { Injectable } from '@nestjs/common';
import createLoggerWithPrefix from '@aikb/log-management/logger';
import { YourMessagePattern } from './interfaces/message-pattern.interface';

const logger = createLoggerWithPrefix('YourMicroserviceService');

@Injectable()
export class YourMicroserviceService {
  async processMessage(data: YourMessagePattern): Promise<any> {
    try {
      logger.info(`Processing message: ${JSON.stringify(data)}`);
      
      // Your business logic here
      
      logger.info('Message processed successfully');
      return { success: true, message: 'Message processed successfully' };
    } catch (error) {
      logger.error('Error processing message:', error);
      throw error;
    }
  }
}
```

### 6. 消息接口

创建`apps/your-domain/your-microservice-name/src/your-microservice/interfaces/message-pattern.interface.ts`文件：

```typescript
export interface YourMessagePattern {
  id: string;
  data: any;
  timestamp: Date;
  // Add other fields as needed
}
```

## 配置构建和部署脚本

### 1. 更新根目录 package.json

在根目录的`package.json`中添加新的脚本：

```json
{
  "scripts": {
    // ... existing scripts
    "start:your-microservice": "nx serve your-microservice-name",
    "build:your-microservice": "nx build your-microservice-name",
    "test:your-microservice": "nx test your-microservice-name"
  }
}
```

### 2. 环境配置

创建`apps/your-domain/your-microservice-name/.env`文件：

```env
# RabbitMQ Configuration
RABBITMQ_URL=amqp://localhost:5672
RABBITMQ_QUEUE=your-microservice-queue

# Server Configuration
PORT=3000

# Logging
LOG_LEVEL=info
```

## 测试微服务

### 1. 单元测试

创建`apps/your-domain/your-microservice-name/src/your-microservice/your-microservice.service.spec.ts`文件：

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { YourMicroserviceService } from './your-microservice.service';

describe('YourMicroserviceService', () => {
  let service: YourMicroserviceService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [YourMicroserviceService],
    }).compile();

    service = module.get<YourMicroserviceService>(YourMicroserviceService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should process message correctly', async () => {
    const testData = {
      id: 'test-id',
      data: { test: 'data' },
      timestamp: new Date(),
    };

    const result = await service.processMessage(testData);
    expect(result.success).toBe(true);
  });
});
```

### 2. 集成测试

创建`apps/your-domain/your-microservice-name/src/app.controller.spec.ts`文件：

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });
});
```

### 3. 运行测试

```bash
# 运行单元测试
nx test your-microservice-name

# 运行测试并生成覆盖率报告
nx test your-microservice-name --coverage
```

## 最佳实践

### 1. 代码组织

- 按功能模块组织代码，而不是按技术层次
- 使用接口定义服务间的契约
- 保持模块间的低耦合和高内聚

### 2. 错误处理

- 使用NestJS的异常过滤器统一处理错误
- 实现重试机制处理临时性错误
- 记录详细的错误日志以便调试

### 3. 配置管理

- 使用环境变量管理配置
- 为不同环境创建不同的配置文件
- 敏感信息使用密钥管理服务

### 4. 监控和日志

- 使用结构化日志记录关键事件
- 实现健康检查端点
- 监控关键性能指标

### 5. 测试策略

- 编写单元测试覆盖业务逻辑
- 使用集成测试验证组件间交互
- 实现端到端测试验证完整流程

## 部署

### 1. Docker化

创建`apps/your-domain/your-microservice-name/Dockerfile`：

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY dist/ ./dist/

EXPOSE 3000

CMD ["node", "dist/main.js"]
```

### 2. Kubernetes部署

创建`apps/your-domain/your-microservice-name/k8s/deployment.yaml`：

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: your-microservice-name
spec:
  replicas: 3
  selector:
    matchLabels:
      app: your-microservice-name
  template:
    metadata:
      labels:
        app: your-microservice-name
    spec:
      containers:
      - name: your-microservice-name
        image: your-registry/your-microservice-name:latest
        ports:
        - containerPort: 3000
        env:
        - name: RABBITMQ_URL
          valueFrom:
            secretKeyRef:
              name: rabbitmq-secret
              key: url
        - name: RABBITMQ_QUEUE
          value: "your-microservice-queue"
```

## 总结

通过本指南，您应该能够在Nx管理的monorepo中成功创建和部署NestJS微服务。关键要点包括：

1. 使用Nx生成器或手动创建项目结构
2. 正确配置TypeScript和构建选项
3. 实现微服务核心功能（控制器、服务等）
4. 编写全面的测试
5. 遵循最佳实践确保代码质量和可维护性

如果您需要更多关于特定方面的信息，请参考NestJS和Nx的官方文档。