# Nx NestJS微服务快速参考指南

本指南提供了在Nx管理的monorepo中创建NestJS微服务的快速参考命令和配置。

## 基本命令

### 1. 创建新的NestJS应用

```bash
# 基本命令
npx nx g @nx/nest:app your-microservice-name

# 指定目录
npx nx g @nx/nest:app your-microservice-name --directory=apps/your-domain/your-microservice-name

# 禁用路由和样式
npx nx g @nx/nest:app your-microservice-name --directory=apps/your-domain/your-microservice-name --routing=false --style=scss
```

### 2. 生成NestJS组件

```bash
# 生成模块
npx nx g @nx/nest:module your-module-name --project=your-microservice-name

# 生成控制器
npx nx g @nx/nest:controller your-controller-name --project=your-microservice-name

# 生成服务
npx nx g @nx/nest:service your-service-name --project=your-microservice-name

# 生成接口
npx nx g @nx/nest:interface your-interface-name --project=your-microservice-name
```

### 3. 构建和运行

```bash
# 构建应用
nx build your-microservice-name

# 运行应用（开发模式）
nx serve your-microservice-name

# 运行应用（生产模式）
nx serve your-microservice-name --configuration=production

# 测试应用
nx test your-microservice-name

# 代码检查
nx lint your-microservice-name
```

## 项目结构

### 推荐的目录结构

```
apps/
└── your-domain/
    └── your-microservice-name/
        ├── src/
        │   ├── main.ts
        │   ├── app.module.ts
        │   ├── app.controller.ts
        │   ├── app.service.ts
        │   ├── your-module/
        │   │   ├── your-module.module.ts
        │   │   ├── your-module.controller.ts
        │   │   ├── your-module.service.ts
        │   │   └── interfaces/
        │   │       └── your-interface.interface.ts
        │   ├── config/
        │   │   └── configuration.ts
        │   └── utils/
        │       └── helpers.ts
        ├── test/
        │   └── ...
        ├── package.json
        ├── tsconfig.json
        ├── tsconfig.app.json
        ├── tsconfig.spec.json
        ├── project.json
        ├── .env
        ├── .env.example
        ├── Dockerfile
        └── README.md
```

## 核心配置文件

### 1. package.json

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

### 2. project.json

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

### 3. tsconfig.app.json

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

## 核心代码模板

### 1. main.ts

```typescript
import { config } from 'dotenv';
import { NestFactory } from '@nestjs/core';
import { Transport, MicroserviceOptions } from '@nestjs/microservices';
import { AppModule } from './app.module';
import createLoggerWithPrefix from '@aikb/log-management/logger';

config();

const logger = createLoggerWithPrefix('YourMicroserviceName');

async function bootstrap() {
  try {
    const app = await NestFactory.create(AppModule, {
      logger: ['error', 'warn', 'log', 'debug', 'verbose'],
    });

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

### 2. 控制器模板

```typescript
import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { YourService } from './your.service';
import { YourMessageInterface } from '../interfaces/your-message.interface';

@Controller()
export class YourController {
  constructor(private readonly yourService: YourService) {}

  @EventPattern('your.message.pattern')
  async handleYourMessage(@Payload() data: YourMessageInterface) {
    return this.yourService.processMessage(data);
  }
}
```

### 3. 服务模板

```typescript
import { Injectable } from '@nestjs/common';
import createLoggerWithPrefix from '@aikb/log-management/logger';
import { YourMessageInterface } from '../interfaces/your-message.interface';

const logger = createLoggerWithPrefix('YourService');

@Injectable()
export class YourService {
  async processMessage(data: YourMessageInterface): Promise<any> {
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

## 环境配置

### .env 文件

```env
# RabbitMQ Configuration
RABBITMQ_URL=amqp://localhost:5672
RABBITMQ_QUEUE=your-microservice-queue

# Server Configuration
PORT=3000

# Logging
LOG_LEVEL=info

# Database (if needed)
DATABASE_URL=mongodb://localhost:27017/your-database

# External Services
EXTERNAL_API_URL=https://api.example.com
EXTERNAL_API_KEY=your-api-key
```

## Docker配置

### Dockerfile

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY dist/ ./dist/

EXPOSE 3000

CMD ["node", "dist/main.js"]
```

### docker-compose.yml

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

  your-microservice:
    build: .
    ports:
      - "3000:3000"
    environment:
      RABBITMQ_URL: amqp://admin:password@rabbitmq:5672
      RABBITMQ_QUEUE: your-microservice-queue
      PORT: 3000
      LOG_LEVEL: info
    depends_on:
      - rabbitmq
```

## 测试模板

### 服务测试

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { YourService } from './your.service';

describe('YourService', () => {
  let service: YourService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [YourService],
    }).compile();

    service = module.get<YourService>(YourService);
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

## 常用Nx命令

```bash
# 查看项目图
nx graph

# 查看受影响的项目
nx affected:apps

# 运行受影响项目的测试
nx affected:test

# 运行受影响项目的构建
nx affected:build

# 查看项目依赖关系
nx show project your-microservice-name --web

# 迁移到最新版本的Nx
nx migrate latest
```

## 最佳实践

1. **命名约定**：使用kebab-case命名微服务，如`notification-service`
2. **环境变量**：使用`.env`文件管理配置，不要提交敏感信息
3. **错误处理**：实现全局异常过滤器
4. **日志记录**：使用结构化日志记录关键事件
5. **测试**：编写单元测试和集成测试
6. **健康检查**：实现健康检查端点
7. **文档**：为API和消息模式编写文档

## 故障排除

### 常见问题

1. **端口冲突**：确保每个微服务使用不同的端口
2. **RabbitMQ连接失败**：检查RabbitMQ服务是否运行，URL是否正确
3. **构建失败**：检查TypeScript配置和依赖项
4. **测试失败**：确保测试环境配置正确

### 调试技巧

1. 使用`--verbose`标志获取详细日志
2. 检查`dist`目录中的构建输出
3. 使用Nx项目图查看依赖关系
4. 检查环境变量是否正确设置

这个快速参考指南应该能帮助您快速开始创建NestJS微服务。如需更详细的信息，请参考完整的指南文档。