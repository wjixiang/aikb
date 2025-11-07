/**
 * 迁移示例：展示如何将现有的服务迁移到使用共用的微服务客户端模块
 */

// ============================================================================
// 之前的实现方式（直接使用 ClientsModule.register）
// ============================================================================

/*
// apps/bibliography-service/src/app/app.module.ts
import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';

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
*/

/*
// apps/pdf2md-service/src/app/app.module.ts
@Module({
  imports: [ClientsModule.register([{
      name: 'pdf_2_markdown_service',
      transport: Transport.RMQ,
      options: {
        urls: [
          `amqp://${process.env['RABBITMQ_USERNAME']}:${process.env['RABBITMQ_PASSWORD']}@${process.env['RABBITMQ_HOSTNAME']}:${process.env['RABBITMQ_AMQP_PORT']}/${process.env['RABBITMQ_VHOST']}`,
        ],
        queue: 'pdf_2_markdown_queue',
      },
    }])],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
*/

// ============================================================================
// 迁移后的实现方式（使用共用的微服务客户端模块）
// ============================================================================

import { Module } from '@nestjs/common';
import { 
  MicroserviceClientModule, 
  MICROSERVICE_CLIENTS, 
  registerCommonMicroserviceClients 
} from './microservice-client.module';

/**
 * 迁移示例 1: bibliography-service
 * 
 * 之前：直接配置 ClientsModule.register
 * 之后：使用预定义的客户端配置
 */
@Module({
  imports: [
    // 简化为一行，使用预定义配置
    MicroserviceClientModule.register(MICROSERVICE_CLIENTS.PDF_2_MARKDOWN_SERVICE),
  ],
  controllers: [/* AppController, LibraryItemController */],
  providers: [/* AppService, LibraryItemService */],
})
export class BibliographyServiceAppModule {}

/**
 * 迁移示例 2: pdf2md-service（作为生产者）
 * 
 * 如果 pdf2md-service 需要发送消息到其他服务
 */
@Module({
  imports: [
    // 注册 bibliography-service 客户端
    MicroserviceClientModule.register(MICROSERVICE_CLIENTS.BIBLIOGRAPHY_SERVICE),
  ],
  controllers: [/* AppController */],
  providers: [/* AppService */],
})
export class Pdf2mdServiceAppModule {}

/**
 * 迁移示例 3: 使用便捷方法
 * 
 * 对于需要多个客户端的服务
 */
@Module({
  imports: [
    // 一次性注册所有常用客户端
    registerCommonMicroserviceClients(),
  ],
  controllers: [/* AppController */],
  providers: [/* AppService */],
})
export class MultiClientServiceAppModule {}

/**
 * 迁移示例 4: 自定义配置
 * 
 * 对于有特殊需求的服务
 */
@Module({
  imports: [
    MicroserviceClientModule.register({
      name: 'CUSTOM_ANALYSIS_SERVICE',
      queue: 'custom_analysis_queue',
      connectionInitOptions: { timeout: 60000 }, // 自定义超时
      heartbeat: 120, // 自定义心跳
      prefetchCount: 5, // 自定义预取数量
    }),
  ],
  controllers: [/* AppController */],
  providers: [/* AppService */],
})
export class CustomConfigServiceAppModule {}

// ============================================================================
// 服务中的使用方式（保持不变）
// ============================================================================

import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

@Injectable()
export class LibraryItemService {
  constructor(
    // 注入方式保持不变
    @Inject('PDF_2_MARKDOWN_SERVICE') private rabbitClient: ClientProxy,
  ) {}

  async producePdf2MarkdownRequest(req: any) {
    // 使用方式保持不变
    this.rabbitClient.emit('pdf-2-markdown-conversion', req);
  }
}

// ============================================================================
// 迁移检查清单
// ============================================================================

/**
 * 迁移检查清单：
 * 
 * ✅ 1. 安装 @aikb/pdf2md-lib 依赖
 * ✅ 2. 替换 ClientsModule.register 为 MicroserviceClientModule.register
 * ✅ 3. 使用预定义的 MICROSERVICE_CLIENTS 配置
 * ✅ 4. 移除重复的 RabbitMQ 连接配置
 * ✅ 5. 确保环境变量正确设置
 * ✅ 6. 测试微服务通信功能
 * ✅ 7. 验证所有客户端注入正常工作
 * 
 * 注意事项：
 * - 服务中的 ClientProxy 注入和使用方式保持不变
 * - 如果有特殊的连接需求，可以使用自定义配置
 * - 确保所有环境变量都已正确设置
 */

// ============================================================================
// 错误处理和故障排除
// ============================================================================

/**
 * 常见问题和解决方案：
 * 
 * 1. 类型错误：
 *    - 确保导入了正确的模块：import { MicroserviceClientModule } from '@aikb/pdf2md-lib'
 * 
 * 2. 连接失败：
 *    - 检查环境变量是否正确设置
 *    - 验证 RabbitMQ 服务是否运行
 * 
 * 3. 客户端注入失败：
 *    - 确保客户端名称与注册时的一致
 *    - 检查模块导入顺序
 * 
 * 4. 队列不存在：
 *    - 确保队列名称正确
 *    - 检查 RabbitMQ 中的队列配置
 */

// 注意：这些类仅作为示例，不应在实际项目中导出使用
// 实际使用时，请参考这些示例在您自己的服务中实现相应的模块