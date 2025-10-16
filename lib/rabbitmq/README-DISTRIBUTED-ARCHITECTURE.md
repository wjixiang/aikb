
# 分布式微服务架构设计方案

## 概述

本文档描述了知识库系统的分布式微服务架构设计方案，采用"单体仓库，分布式部署"（Monorepo with Distributed Deployment）模式，实现统一开发、分布式部署的现代化架构。

## 架构原则

### 1. 单体仓库，分布式部署
- **开发阶段**：所有微服务在同一个代码库中统一管理
- **部署阶段**：不同服务部署到不同的服务器，通过 RabbitMQ 通信

### 2. 消息驱动架构
- 服务间通过 RabbitMQ 进行异步通信
- 支持可靠消息传递、重试机制和错误处理
- 实现服务间的松耦合

### 3. 服务自治
- 每个服务独立开发、测试、部署和扩展
- 拥有自己的数据库和业务逻辑
- 通过明确的 API 接口提供服务

## 系统架构

### 整体架构图

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web 服务器    │    │  API 服务器     │    │  管理后台       │
│                 │    │                 │    │                 │
│ - NestJS App    │    │ - API Gateway   │    │ - Admin Panel   │
│ - Static Files  │    │ - Auth Service  │    │ - Monitoring    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │  RabbitMQ 集群  │
                    │                 │
                    │ - 消息队列      │
                    │ - 路由交换      │
                    │ - 持久化存储    │
                    └─────────────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         │                       │                       │
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  计算节点 1     │    │  计算节点 2     │    │  数据节点       │
│                 │    │                 │    │                 │
│ - PDF 转换      │    │ - PDF 分割      │    │ - Markdown 存储 │
│ - PDF 分析      │    │ - PDF 合并      │    │ - 数据库操作    │
│ - 其他计算任务  │    │ - 其他计算任务  │    │ - 搜索服务      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 服务分类

### 1. 计算密集型服务

#### PDF 转换服务 (PDF Conversion Service)
- **功能**：将 PDF 文件转换为 Markdown 格式
- **资源需求**：高 CPU，中等内存
- **部署位置**：计算节点
- **文件**：`lib/rabbitmq/pdf-conversion.worker.ts`

#### PDF 分割服务 (PDF Splitting Service)
- **功能**：将大型 PDF 文件分割为小文件
- **资源需求**：高内存，中等 CPU
- **部署位置**：计算节点
- **文件**：`lib/rabbitmq/pdf-splitting.worker.ts`

#### PDF 合并服务 (PDF Merger Service)
- **功能**：将分割的 PDF 部分合并为完整文件
- **资源需求**：中等 CPU，高内存
- **部署位置**：计算节点
- **文件**：`lib/rabbitmq/pdf-merger.service.ts`

### 2. 数据密集型服务

#### Markdown 存储服务 (Markdown Storage Service)
- **功能**：存储 Markdown 内容并处理分块和嵌入
- **资源需求**：中等 CPU，高网络 I/O
- **部署位置**：数据节点
- **文件**：`lib/rabbitmq/markdown-storage.worker.ts`

#### PDF 分析服务 (PDF Analysis Service)
- **功能**：分析 PDF 元数据和结构信息
- **资源需求**：低 CPU，低内存
- **部署位置**：数据节点
- **文件**：`lib/rabbitmq/pdf-analyzer.service.ts`

### 3. 接口服务

#### API 网关服务 (API Gateway Service)
- **功能**：处理 HTTP 请求，路由到相应服务
- **资源需求**：高网络 I/O，中等 CPU
- **部署位置**：API 服务器

#### 认证服务 (Auth Service)
- **功能**：用户认证和授权
- **资源需求**：低 CPU，低内存
- **部署位置**：API 服务器

## 消息流架构

### 消息类型定义

所有消息类型在 `lib/rabbitmq/message.types.ts` 中统一定义：

```typescript
// PDF 处理相关消息
export interface PdfAnalysisRequestMessage {
  messageId: string;
  timestamp: number;
  eventType: 'PDF_ANALYSIS_REQUEST';
  itemId: string;
  s3Url: string;
  s3Key: string;
  fileName: string;
  priority: 'low' | 'normal' | 'high';
  retryCount: number;
  maxRetries: number;
}

// Markdown 存储相关消息
export interface MarkdownStorageRequestMessage {
  messageId: string;
  timestamp: number;
  eventType: 'MARKDOWN_STORAGE_REQUEST';
  itemId: string;
  markdownContent: string;
  partIndex?: number;
  retryCount: number;
  maxRetries: number;
}
```

### 队列配置

队列配置在 `lib/rabbitmq/rabbitmq.config.ts` 中定义：

```typescript
export const RABBITMQ_QUEUES = {
  PDF_ANALYSIS_REQUEST: 'pdf-analysis-request',
  PDF_CONVERSION_REQUEST: 'pdf-conversion-request',
  PDF_SPLITTING_REQUEST: 'pdf-splitting-request',
  PDF_MERGING_REQUEST: 'pdf-merging-request',
  MARKDOWN_STORAGE_REQUEST: 'markdown-storage-request',
  // ... 其他队列
} as const;
```

### 消息处理流程

```
用户上传 PDF
    ↓
API 网关接收请求
    ↓
发布 PDF_ANALYSIS_REQUEST 消息
    ↓
PDF 分析服务处理
    ↓
发布 PDF_SPLITTING_REQUEST 消息（如果文件过大）
    ↓
PDF 分割服务处理
    ↓
发布 PDF_CONVERSION_REQUEST 消息
    ↓
PDF 转换服务处理
    ↓
发布 MARKDOWN_STORAGE_REQUEST 消息
    ↓
Markdown 存储服务处理
    ↓
处理完成，通知用户
```

## 部署方案

### 开发环境部署

#### 本地开发
```bash
# 启动所有服务
npm run dev:workers

# 启动特定服务
npm run dev:worker:pdf-conversion
npm run dev:worker:markdown-storage
```

#### Docker Compose 开发
```yaml
# docker-compose.dev.yml
version: '3.8'
services:
  rabbitmq:
    image: rabbitmq:3-management
    ports:
      - "5672:5672"
      - "15672:15672"
    environment:
      RABBITMQ_DEFAULT_USER: admin
      RABBITMQ_DEFAULT_PASS: admin123

  mongodb:
    image: mongo:6
    ports:
      - "27017:27017"

  elasticsearch:
    image: elasticsearch:9.1.3
    ports:
      - "9200:9200"
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false

  # 所有 worker 在同一容器中运行
  workers:
    build: .
    command: npm run dev:workers
    depends_on:
      - rabbitmq
      - mongodb
      - elasticsearch
```

### 生产环境部署

#### 计算节点部署
```yaml
# docker-compose.compute-node.yml
version: '3.8'
services:
  pdf-conversion-worker:
    build: .
    command: node scripts/start-pdf-conversion-worker.js
    environment:
      - NODE_ENV=production
      - RABBITMQ_URL=${RABBITMQ_URL}
      - ENABLE_PDF_CONVERSION=true
      - PDF_CONVERSION_WORKERS=4
    resources:
      limits:
        memory: 2G
        cpus: '2.0'
    restart: unless-stopped
    deploy:
      replicas: 2

  pdf-splitting-worker:
    build: .
    command: node scripts/start-pdf-splitting-worker.js
    environment:
      - NODE_ENV=production
      - RABBITMQ_URL=${RABBITMQ_URL}
      - ENABLE_PDF_SPLITTING=true
      - PDF_SPLITTING_WORKERS=2
    resources:
      limits:
        memory: 4G
        cpus: '1.0'
    restart: unless-stopped
```

#### 数据节点部署
```yaml
# docker-compose.data-node.yml
version: '3.8'
services:
  markdown-storage-worker:
    build: .
    command: node scripts/start-markdown-storage-worker.js
    environment:
      - NODE_ENV=production
      - RABBITMQ_URL=${RABBITMQ_URL}
      - MONGODB_URL=${MONGODB_URL}
      - ELASTICSEARCH_URL=${ELASTICSEARCH_URL}
      - ENABLE_MARKDOWN_STORAGE=true
      - MARKDOWN_STORAGE_WORKERS=3
    resources:
      limits:
        memory: 1G
        cpus: '0.5'
    restart: unless-stopped
    deploy:
      replicas: 3

  pdf-analysis-service:
    build: .
    command: node scripts/start-pdf-analysis-service.js
    environment:
      - NODE_ENV=production
      - RABBITMQ_URL=${RABBITMQ_URL}
      - ENABLE_PDF_ANALYSIS=true
    resources:
      limits:
        memory: 512M
        cpus: '0.25'
    restart: unless-stopped
```

### Kubernetes 部署

#### 命名空间配置
```yaml
# k8s/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: knowledge-base
```

#### ConfigMap 配置
```yaml
# k8s/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: rabbitmq-config
  namespace: knowledge-base
data:
  RABBITMQ_URL: "amqp://rabbitmq-service:5672"
  RABBITMQ_USERNAME: "admin"
  RABBITMQ_PASSWORD: "admin123"
```

#### PDF 转换工作进程部署
```yaml
# k8s/pdf-conversion-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: pdf-conversion-worker
  namespace: knowledge-base
spec:
  replicas: 3
  selector:
    matchLabels:
      app: pdf-conversion-worker
  template:
    metadata:
      labels:
        app: pdf-conversion-worker
    spec:
      containers:
      - name: pdf-conversion-worker
        image: knowledge-base/pdf-conversion-worker:latest
        envFrom:
        - configMapRef:
            name: rabbitmq-config
        - secretRef:
            name: rabbitmq-secret
        resources:
          requests:
            memory: "1Gi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "2000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
```

## 服务配置

### 环境变量配置

```typescript
// config/services.ts
export interface ServiceConfig {
  enabled: boolean;
  workers: number;
  resources: {
    memory: string;
    cpu: string;
  };
  retryAttempts: number;
  timeout: number;
}

export const SERVICE_CONFIG: Record<string, ServiceConfig> = {
  pdfConversion: {
    enabled: process.env.ENABLE_PDF_CONVERSION === 'true',
    workers: parseInt(process.env.PDF_CONVERSION_WORKERS || '2'),
    resources: {
      memory: process.env.PDF_CONVERSION_MEMORY || '1G',
      cpu: process.env.PDF_CONVERSION_CPU || '0.5'
    },
    retryAttempts: parseInt(process.env.PDF_CONVERSION_RETRY_ATTEMPTS || '3'),
    timeout: parseInt(process.env.PDF_CONVERSION_TIMEOUT || '300000') // 5分钟
  },
  markdownStorage: {
    enabled: process.env.ENABLE_MARKDOWN_STORAGE === 'true',
    workers: parseInt(process.env.MARKDOWN_STORAGE_WORKERS || '1'),
    resources: {
      memory: process.env.MARKDOWN_STORAGE_MEMORY || '512M',
      cpu: process.env.MARKDOWN_STORAGE_CPU || '0.25'
    },
    retryAttempts: parseInt(process.env.MARKDOWN_STORAGE_RETRY_ATTEMPTS || '3'),
    timeout: parseInt(process.env.MARKDOWN_STORAGE_TIMEOUT || '60000') // 1分钟
  },
  // ... 其他服务配置
};
```

### 启动脚本

```typescript
// scripts/start-workers.ts
import { SERVICE_CONFIG } from '../config/services';
import { createPdfConversionWorker } from '../lib/rabbitmq/pdf-conversion.worker';
import { createPdfSplittingWorker } from '../lib/rabbitmq/pdf-splitting.worker';
import { createPdfAnalyzerService } from '../lib/rabbitmq/pdf-analyzer.service';
import { createPdfMergerService } from '../lib/rabbitmq/pdf-merger.service';
import { startMarkdownStorageWorker } from '../lib/rabbitmq/markdown-storage.worker';
import { createStorage } from '../storage/storage';
import createLoggerWithPrefix from '../lib/logger';

const logger = createLoggerWithPrefix('WorkerManager');

async function startEnabledWorkers() {
  const storage = createStorage();
  const workers = [];
  
  try {
    // 启动 PDF 转换工作进程
    if (SERVICE_CONFIG.pdfConversion.enabled) {
      logger.info(`Starting ${SERVICE_CONFIG.pdfConversion.workers} PDF conversion workers`);
      for (let i = 0; i < SERVICE_CONFIG.pdfConversion.workers; i++) {
        const worker = await createPdfConversionWorker(storage);
        workers.push({ name: `pdf-conversion-${i}`, worker });
      }
    }
    
    // 启动 PDF 分割工作进程
    if (SERVICE_CONFIG.pdfSplitting.enabled) {
      logger.info(`Starting ${SERVICE_CONFIG.pdfSplitting.workers} PDF splitting workers`);
      for (let i = 0; i < SERVICE_CONFIG.pdfSplitting.workers; i++) {
        const worker = await createPdfSplittingWorker(storage);
        workers.push({ name: `pdf-splitting-${i}`, worker });
      }
    }
    
    // 启动 Markdown 存储工作进程
    if (SERVICE_CONFIG.markdownStorage.enabled) {
      logger.info(`Starting ${SERVICE_CONFIG.markdownStorage.workers} markdown storage workers`);
      for (let i = 0; i < SERVICE_CONFIG.markdownStorage.workers; i++) {
        const worker = await startMarkdownStorageWorker(storage);
        workers.push({ name: `markdown-storage-${i}`, worker });
      }
    }
    
    // 启动 PDF 分析服务
    if (SERVICE_CONFIG.pdfAnalysis.enabled) {
      logger.info('Starting PDF analysis service');
      const service = createPdfAnalyzerService(storage);
      workers.push({ name: 'pdf-analysis', worker: service });
    }
    
    // 启动 PDF 合并服务
    if (SERVICE_CONFIG.pdfMerging.enabled) {
      logger.info('Starting PDF merger service');
      const service = await createPdfMergerService(storage);
      workers.push({ name: 'pdf-merging', worker: service });
    }
    
    logger.info(`Successfully started ${workers.length} workers/services`);
    
    // 处理优雅关闭
    process.on('SIGINT', async () => {
      logger.info('Received SIGINT, shutting down gracefully...');
      await Promise.all(
        workers.map(async ({ name, worker }) => {
          try {
            if ('stop' in worker && typeof worker.stop === 'function') {
              await worker.stop();
              logger.info(`${name} stopped successfully`);
            }
          } catch (error) {
            logger.error(`Error stopping ${name}:`, error);
          }
        })
      );
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      logger.info('Received SIGTERM, shutting down gracefully...');
      await Promise.all(
        workers.map(async ({ name, worker }) => {
          try {
            if ('stop' in worker && typeof worker.stop === 'function') {
              await worker.stop();
              logger.info(`${name} stopped successfully`);
            }
          } catch (error) {
            logger.error(`Error stopping ${name}:`, error);
          }
        })
      );
      process.exit(0);
    });
    
  } catch (error) {
    logger.error('Failed to start workers:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  startEnabledWorkers();
}

export { startEnabledWorkers };
```

## 监控和日志

### 分布式追踪

```typescript
// lib/tracing.ts
import * as trace from '@opentelemetry/api';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';

const sdk = new NodeSDK({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: process.env.SERVICE_NAME || 'unknown-service',
    [SemanticResourceAttributes.SERVICE_VERSION]: process.env.SERVICE_VERSION || '1.0.0',
  }),
  traceExporter: new JaegerExporter({
    endpoint: process.env.JAEGER_ENDPOINT || 'http://localhost:14268/api/traces',
  }),
});

sdk.start();

export const tracer = trace.getTracer(process.env.SERVICE_NAME || 'unknown-service');

export function traceWorker(workerName: string, operation: string) {
  return tracer.startSpan(`${workerName}.${operation}`);
}
```

### 健康检查

```typescript
// lib/health.ts
import { getRabbitMQService } from './rabbitmq/rabbitmq.service';
import { connectToDatabase } from './mongodb';

export interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  timestamp: number;
  services: {
    rabbitmq: boolean;
    mongodb: boolean;
    elasticsearch: boolean;
  };
  details?: any;
}

export async function getHealthStatus(): Promise<HealthStatus> {
  const timestamp = Date.now();
  const services = {
    rabbitmq: false,
    mongodb: false,
    elasticsearch: false,
  };
  
  try {
    // 检查 RabbitMQ 连接
    const rabbitMQService = getRabbitMQService();
    services.rabbitmq = rabbitMQService.isConnected();
  } catch (error) {
    console.error('RabbitMQ health check failed:', error);
  }
  
  try {
    // 检查 MongoDB 连接
    const { client } = await connectToDatabase();
    services.mongodb = client.isConnected();
  } catch (error) {
    console.error('MongoDB health check failed:', error);
  }
  
  try {
    // 检查 Elasticsearch 连接
    const { Client } = require('@elastic/elasticsearch');
    const client = new Client({ node: process.env.ELASTICSEARCH_URL });
    await client.ping();
    services.elasticsearch = true;
  } catch (error) {
    console.error('Elasticsearch health check failed:', error);
  }
  
  const allHealthy = Object.values(services).every(status => status);
  
  return {
    status: allHealthy ? 'healthy' : 'unhealthy',
    timestamp,
    services,
    details: {
      serviceName: process.env.SERVICE_NAME || 'unknown',
      version: process.env.SERVICE_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
    }
  };
}
```

### 指标收集

```typescript
// lib/metrics.ts
import { Counter, Histogram, register } from 'prom-client';

// 创建指标
export const messageProcessedCounter = new Counter({
  name: 'messages_processed_total',
  help: 'Total number of messages processed',
  labelNames: ['service', 'status'],
});

export const messageProcessingDuration = new Histogram({
  name: 'message_processing_duration_seconds',
  help: 'Duration of message processing in seconds',
  labelNames: ['service'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60, 120, 300],
});

export const activeConnectionsGauge = new Gauge({
  name: 'active_connections',
  help: 'Number of active connections',
  labelNames: ['service'],
});

// 注册指标
register.registerMetric(messageProcessedCounter);
register.registerMetric(messageProcessingDuration);
register.registerMetric(activeConnectionsGauge);

// 导出指标端点
export function getMetrics(): string {
  return register.metrics();
}
```

## 部署流程

### CI/CD 流水线

```yaml
# .github/workflows/deploy.yml
name: Deploy Services

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - uses: actions/setup-node@v3
      with:
        node-version: '18'
    - run: npm ci
    - run: npm run test
    - run: npm run lint

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - uses: docker/setup-buildx-action@v2
    - uses: docker/login-action@v2
      with:
        username: ${{ secrets.DOCKER_USERNAME }}
        password: ${{ secrets.DOCKER_PASSWORD }}
    
    # 构建各个服务的镜像
    - name: Build PDF conversion worker image
      uses: docker/build-push-action@v4
      with:
        context: .
        file: ./docker/pdf-conversion.worker.Dockerfile
        push: true
        tags: ${{ secrets.DOCKER_REGISTRY }}/pdf-conversion-worker:${{ github.sha }}
    
    - name: Build Markdown storage worker image
      uses: docker/build-push-action@v4
      with:
        context: .
        file: ./docker/markdown-storage.worker.Dockerfile
        push: true
        tags: ${{ secrets.DOCKER_REGISTRY }}/markdown-storage-worker:${{ github.sha }}

  deploy:
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
    - uses: actions/checkout@v3
    - name: Deploy to production
      run: |
        # 部署到 Kubernetes 集群
        kubectl set image deployment/pdf-conversion-worker pdf-conversion-worker=${{ secrets.DOCKER_REGISTRY }}/pdf-conversion-worker:${{ github.sha }} -n knowledge-base
        kubectl set image deployment/markdown-storage-worker markdown-storage-worker=${{ secrets.DOCKER_REGISTRY }}/markdown-storage-worker:${{ github.sha }} -n knowledge-base
```

## 安全考虑

### 1. 网络安全
- 使用 TLS 加密服务间通信
- 配置防火墙规则限制访问
- 使用 VPN 或专用网络连接

### 2. 认证和授权
- 使用 JWT 进行服务间认证
- 实现基于角色的访问控制
- 定期轮换密钥和令牌

### 3. 数据安全
- 加密敏感数据存储
- 使用环境变量管理配置
- 实现审计日志

## 故障处理

### 1. 服务故障
- 实现自动重启机制
- 配置健康检查和自动恢复
- 设置告警阈值

### 2. 网络故障
- 实现重试机制和断路器模式
- 配置超时和重试策略
- 使用消息队列的持久化功能

### 3. 数据故障
- 实现数据备份和恢复策略
- 配置主从复制和故障切换
- 定期测试恢复流程

## 性能优化

### 1. 水平扩展
- 根据负载自动扩展服务实例
- 实现负载均衡策略
- 优化资源分配

### 2. 缓存策略
- 使用 Redis 缓存频繁访问的数据
- 实现分布式缓存
- 配置缓存过期策略

### 3. 数据库优化
- 优化数据库查询和索引
- 实现读写分离
- 配置连接池

## 总结

本分布式微服务架构设计方案提供了一个可扩展、可维护、高可用的知识库系统架构。通过合理的服务分类、消息驱动架构和容器化部署，实现了：

1. **服务自治**：每个服务独立开发、测试、部署和扩展
2. **松耦合**：服务间通过 RabbitMQ 进行异步通信，降低依赖
3. **高可用**：支持故障隔离、自动恢复和负载均衡
4. **可扩展**：可根据负载需求独立扩展各个服务
5. **易维护**：统一的代码库和标准化的部署流程

这种架构特别适合知识库系统这种需要处理大量文档转换和存储的场景，能够有效应对高并发、大数据量的挑战。

## 下一步实施计划

### 第一阶段：基础架构完善（1-2周）
- [ ] 为每个服务创建独立的启动脚本
- [ ] 实现基于环境变量的服务配置
- [ ] 添加健康检查和监控端点
- [ ] 完善错误处理和重试机制

### 第二阶段：容器化部署（2-3周）
- [ ] 为每个服务创建 Dockerfile
- [ ] 编写 Docker Compose 文件
- [ ] 实现本地多容器开发环境
- [ ] 添加容器健康检查

### 第三阶段：生产环境部署（3-4周）
- [ ] 选择容器编排平台（Kubernetes/Docker Swarm）
- [ ] 实现服务发现和负载均衡
- [ ] 添加分布式追踪和监控
- [ ] 配置日志聚合和分析

### 第四阶段：优化和扩展（持续）
- [ ] 实现自动扩缩容
- [ ] 优化资源使用和性能
- [ ] 添加更多微服务
- [ ] 完善安全机制

## 相关文档

- [RabbitMQ 配置指南](./rabbitmq.config.ts)
- [消息类型定义](./message.types.ts)
- [服务实现文档](./pdf-conversion.worker.ts)
- [部署脚本示例](../../scripts/)

## 联系和支持

如有任何问题或建议，请联系开发团队或提交 Issue。