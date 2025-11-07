import { Module, DynamicModule } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';

/**
 * 微服务客户端配置接口
 */
export interface MicroserviceClientConfig {
  name: string;
  queue?: string;
  connectionInitOptions?: { timeout: number };
  heartbeat?: number;
  prefetchCount?: number;
}

/**
 * 创建 NestJS 微服务客户端模块
 */
export class MicroserviceClientModule {
  /**
   * 注册单个微服务客户端
   */
  static register(config: MicroserviceClientConfig): DynamicModule {
    const clientOptions = {
      name: config.name,
      transport: Transport.RMQ,
      options: {
        urls: [
          `amqp://${process.env['RABBITMQ_USERNAME']}:${process.env['RABBITMQ_PASSWORD']}@${process.env['RABBITMQ_HOSTNAME']}:${process.env['RABBITMQ_AMQP_PORT']}/${process.env['RABBITMQ_VHOST']}`,
        ],
        queue: config.queue || `${config.name}_queue`,
        connectionInitOptions: config.connectionInitOptions || { timeout: 30000 },
        heartbeat: config.heartbeat || 60,
        prefetchCount: config.prefetchCount || 1,
      },
    } as any; // 使用类型断言来避免 TypeScript 类型检查问题

    return {
      module: MicroserviceClientModule,
      imports: [ClientsModule.register([clientOptions])],
      exports: [ClientsModule],
    };
  }

  /**
   * 注册多个微服务客户端
   */
  static registerAsync(configs: MicroserviceClientConfig[]): DynamicModule {
    const clientOptions = configs.map(config => ({
      name: config.name,
      transport: Transport.RMQ,
      options: {
        urls: [
          `amqp://${process.env['RABBITMQ_USERNAME']}:${process.env['RABBITMQ_PASSWORD']}@${process.env['RABBITMQ_HOSTNAME']}:${process.env['RABBITMQ_AMQP_PORT']}/${process.env['RABBITMQ_VHOST']}`,
        ],
        queue: config.queue || `${config.name}_queue`,
        connectionInitOptions: config.connectionInitOptions || { timeout: 30000 },
        heartbeat: config.heartbeat || 60,
        prefetchCount: config.prefetchCount || 1,
      },
    })) as any[]; // 使用类型断言来避免 TypeScript 类型检查问题

    return {
      module: MicroserviceClientModule,
      imports: [ClientsModule.register(clientOptions)],
      exports: [ClientsModule],
    };
  }
}

/**
 * 预定义的微服务客户端配置
 */
export const MICROSERVICE_CLIENTS = {
  PDF_2_MARKDOWN_SERVICE: {
    name: 'PDF_2_MARKDOWN_SERVICE',
    queue: process.env['RABBITMQ_QUEUE'] || 'pdf_2_markdown_queue',
  },
  BIBLIOGRAPHY_SERVICE: {
    name: 'BIBLIOGRAPHY_SERVICE',
    queue: 'bibliography_queue',
  },
  PDF_ANALYSIS_SERVICE: {
    name: 'PDF_ANALYSIS_SERVICE',
    queue: 'pdf_analysis_queue',
  },
  CHUNKING_EMBEDDING_SERVICE: {
    name: 'CHUNKING_EMBEDDING_SERVICE',
    queue: 'chunking_embedding_request',
  },
} as const;

/**
 * 便捷方法：注册所有预定义的微服务客户端
 */
export function registerAllMicroserviceClients(): DynamicModule {
  return MicroserviceClientModule.registerAsync([
    MICROSERVICE_CLIENTS.PDF_2_MARKDOWN_SERVICE,
    MICROSERVICE_CLIENTS.BIBLIOGRAPHY_SERVICE,
    MICROSERVICE_CLIENTS.PDF_ANALYSIS_SERVICE,
    MICROSERVICE_CLIENTS.CHUNKING_EMBEDDING_SERVICE,
  ]);
}

/**
 * 便捷方法：注册常用的微服务客户端
 */
export function registerCommonMicroserviceClients(): DynamicModule {
  return MicroserviceClientModule.registerAsync([
    MICROSERVICE_CLIENTS.PDF_2_MARKDOWN_SERVICE,
    MICROSERVICE_CLIENTS.BIBLIOGRAPHY_SERVICE,
  ]);
}