/**
 * 微服务客户端模块使用示例
 */

import { Module } from '@nestjs/common';
import { 
  MicroserviceClientModule, 
  MICROSERVICE_CLIENTS, 
  registerCommonMicroserviceClients,
  registerAllMicroserviceClients 
} from './microservice-client.module';

/**
 * 示例 1: 注册单个微服务客户端
 */
@Module({
  imports: [
    MicroserviceClientModule.register(MICROSERVICE_CLIENTS.PDF_2_MARKDOWN_SERVICE),
  ],
})
export class ExampleSingleClientModule {}

/**
 * 示例 2: 注册多个微服务客户端
 */
@Module({
  imports: [
    MicroserviceClientModule.registerAsync([
      MICROSERVICE_CLIENTS.PDF_2_MARKDOWN_SERVICE,
      MICROSERVICE_CLIENTS.BIBLIOGRAPHY_SERVICE,
    ]),
  ],
})
export class ExampleMultipleClientsModule {}

/**
 * 示例 3: 使用便捷方法注册常用客户端
 */
@Module({
  imports: [
    registerCommonMicroserviceClients(),
  ],
})
export class ExampleCommonClientsModule {}

/**
 * 示例 4: 使用便捷方法注册所有客户端
 */
@Module({
  imports: [
    registerAllMicroserviceClients(),
  ],
})
export class ExampleAllClientsModule {}

/**
 * 示例 5: 自定义配置
 */
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
export class ExampleCustomConfigModule {}

/**
 * 在服务中使用客户端的示例
 */
import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

@Injectable()
export class ExampleService {
  constructor(
    @Inject('PDF_2_MARKDOWN_SERVICE') private pdf2mdClient: ClientProxy,
    @Inject('BIBLIOGRAPHY_SERVICE') private bibliographyClient: ClientProxy,
  ) {}

  async sendPdfConversionRequest(data: any) {
    // 发送 PDF 转换请求
    return this.pdf2mdClient.emit('pdf-2-markdown-conversion', data);
  }

  async sendBibliographyRequest(data: any) {
    // 发送文献服务请求
    return this.bibliographyClient.emit('bibliography-event', data);
  }

  async sendPdfConversionRequestWithResponse(data: any) {
    // 发送请求并等待响应
    return this.pdf2mdClient.send('pdf-2-markdown-conversion', data).toPromise();
  }
}