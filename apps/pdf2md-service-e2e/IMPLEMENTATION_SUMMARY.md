# PDF2MD Service E2E Testing Implementation Summary

本文档总结了为 PDF2MD RabbitMQ 微服务实现的端到端测试解决方案。

## 问题背景

传统的 HTTP 微服务可以通过等待端口开放来确保服务已启动并准备好接受测试。然而，RabbitMQ 微服务不监听 HTTP 端口，而是通过消息队列进行通信，这需要不同的测试方法。

## 解决方案概述

我们实现了一个完整的端到端测试框架，专门针对 RabbitMQ 微服务的特点进行了优化：

### 1. 服务启动和等待机制

**文件**: `src/support/global-setup.ts`

- 替换了传统的端口等待机制，改为等待 RabbitMQ 连接可用
- 添加了详细的环境变量日志记录，便于调试
- 实现了重试机制，确保 RabbitMQ 完全启动后再运行测试
- 添加了 vhost 路径格式验证，确保连接字符串正确

### 2. 测试环境配置

**文件**: `src/support/test-setup.ts`

- 创建了 NestJS 微服务客户端，专门用于 RabbitMQ 通信
- 配置了队列选项，包括持久化和预取计数
- 将客户端添加到全局作用域，使所有测试都可以访问
- 添加了错误处理和连接验证

### 3. 清理和资源管理

**文件**: `src/support/global-teardown.ts`

- 实现了队列清理功能，确保测试之间不会相互干扰
- 添加了客户端连接关闭，防止资源泄漏
- 实现了优雅的错误处理，即使清理失败也不会影响测试流程

### 4. 自动化服务管理

**文件**: `scripts/start-services.sh`

- 创建了自动启动 RabbitMQ 服务的脚本
- 实现了健康检查，确保 RabbitMQ 完全启动后再运行测试
- 添加了详细的日志记录和错误处理
- 支持多种 Docker Compose 版本

### 5. 测试配置优化

**文件**: `project.json`

- 修改了环境文件路径，指向包含 RabbitMQ 配置的 `.env` 文件
- 添加了预命令，自动执行服务启动脚本
- 配置了 CI 环境特定的环境变量
- 添加了 `passWithNoTests` 选项，提高测试灵活性

### 6. 示例测试用例

**文件**: `src/pdf2md-service/pdf2md-service.e2e.test.ts`

- 创建了全面的测试用例，涵盖各种场景
- 包括成功场景、错误处理、性能测试等
- 实现了适当的超时设置，适应消息队列的异步特性
- 添加了详细的错误处理和日志记录

### 7. 文档和工具

**文件**: `README.md`

- 创建了详细的文档，解释如何运行和配置测试
- 包含了故障排除指南和最佳实践
- 提供了手动和自动服务管理的说明

**文件**: `scripts/verify-setup.sh`

- 创建了环境验证脚本，检查所有必要的配置
- 验证文件存在性、环境变量、Docker 安装等
- 提供了清晰的错误消息和修复建议

**文件**: `scripts/run-tests.sh`

- 创建了简化的测试运行脚本
- 支持 CI 配置参数
- 提供了清晰的执行反馈

## 关键技术决策

### 1. 连接等待策略

我们选择直接测试 RabbitMQ 连接，而不是仅仅检查端口开放。这确保了 RabbitMQ 不仅在运行，而且可以接受连接。

### 2. 全局客户端管理

使用全局作用域共享 RabbitMQ 客户端，避免了每个测试都创建新连接的开销，同时确保了资源的一致管理。

### 3. 队列清理策略

在测试完成后清理队列，确保测试之间的隔离性，防止一个测试的结果影响另一个测试。

### 4. 错误处理哲学

实现了"优雅降级"的错误处理策略：即使某些清理操作失败，也不会中断整个测试流程，但会记录详细的警告信息。

## 使用方法

### 基本用法

```bash
# 自动启动服务并运行测试
nx run pdf2md-service-e2e:e2e

# 或使用脚本
./scripts/run-tests.sh
```

### CI 环境

```bash
# 使用 CI 配置
nx run pdf2md-service-e2e:e2e --configuration=ci

# 或使用脚本
./scripts/run-tests.sh ci
```

### 手动服务管理

```bash
# 手动启动 RabbitMQ
cd .devcontainer
docker-compose up -d rabbitmq

# 运行测试（跳过自动启动）
nx run pdf2md-service-e2e:e2e --skipPreCommands
```

### 环境验证

```bash
# 验证测试环境配置
./scripts/verify-setup.sh
```

## 故障排除

### 常见问题

1. **RabbitMQ 连接失败**
   - 检查 Docker Compose 是否正在运行
   - 验证环境变量是否正确设置
   - 确认 RabbitMQ 容器健康状态

2. **测试超时**
   - 增加测试超时时间
   - 检查微服务是否正确响应消息
   - 验证队列配置是否正确

3. **环境变量问题**
   - 使用 `verify-setup.sh` 脚本检查配置
   - 确保 `.env` 文件包含所有必需的变量
   - 验证 Docker Compose 配置与环境变量匹配

## 扩展和自定义

### 添加新测试

1. 在 `src/pdf2md-service/` 目录下创建新的测试文件
2. 使用 `globalThis.rabbitmqClient` 访问 RabbitMQ 客户端
3. 遵循现有的测试模式和错误处理策略

### 修改队列配置

1. 更新 `test-setup.ts` 中的队列名称和选项
2. 相应地更新 `global-teardown.ts` 中的清理逻辑
3. 确保微服务使用相同的队列配置

### 添加新的环境变量

1. 在 `.env` 文件中添加新变量
2. 在 `project.json` 的 CI 配置中添加默认值
3. 在 `verify-setup.sh` 中添加验证逻辑

## 总结

这个实现提供了一个完整、健壮的解决方案，专门针对 RabbitMQ 微服务的端到端测试需求。它不仅解决了服务启动等待的问题，还提供了全面的测试框架、自动化工具和详细文档，使开发者能够轻松地编写和运行测试。

通过使用这个解决方案，开发团队可以确保 RabbitMQ 微服务的质量和可靠性，同时减少手动配置和故障排除的时间。