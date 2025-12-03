import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventBusService } from '../events/event-bus.service';
import {
  EVENT_TYPES,
  EntityCreatedEvent,
  EntityUpdatedEvent,
  EntityDeletedEvent,
  VertexCreatedEvent,
  VertexUpdatedEvent,
  VertexDeletedEvent,
  PropertyCreatedEvent,
  PropertyUpdatedEvent,
  PropertyDeletedEvent,
  EdgeCreatedEvent,
  EdgeUpdatedEvent,
  EdgeDeletedEvent,
} from '../events/types';

/**
 * 实体事件处理器
 * 负责处理所有与实体相关的事件
 */
@Injectable()
export class EntityEventHandler implements OnModuleInit {
  private readonly logger = new Logger(EntityEventHandler.name);

  constructor(private readonly eventBus: EventBusService) {}

  async onModuleInit() {
    // 注册实体事件处理器
    await this.registerEntityEventHandlers();

    // 注册顶点事件处理器
    await this.registerVertexEventHandlers();

    // 注册属性事件处理器
    await this.registerPropertyEventHandlers();

    // 注册边事件处理器
    await this.registerEdgeEventHandlers();

    this.logger.log('✅ All entity event handlers registered successfully');
  }

  /**
   * 注册实体事件处理器
   */
  private async registerEntityEventHandlers(): Promise<void> {
    await this.eventBus.subscribe(
      EVENT_TYPES.ENTITY_CREATED,
      this.handleEntityCreated.bind(this),
    );

    await this.eventBus.subscribe(
      EVENT_TYPES.ENTITY_UPDATED,
      this.handleEntityUpdated.bind(this),
    );

    await this.eventBus.subscribe(
      EVENT_TYPES.ENTITY_DELETED,
      this.handleEntityDeleted.bind(this),
    );

    this.logger.debug('✅ Entity event handlers registered');
  }

  /**
   * 注册顶点事件处理器
   */
  private async registerVertexEventHandlers(): Promise<void> {
    await this.eventBus.subscribe(
      EVENT_TYPES.VERTEX_CREATED,
      this.handleVertexCreated.bind(this),
    );

    await this.eventBus.subscribe(
      EVENT_TYPES.VERTEX_UPDATED,
      this.handleVertexUpdated.bind(this),
    );

    await this.eventBus.subscribe(
      EVENT_TYPES.VERTEX_DELETED,
      this.handleVertexDeleted.bind(this),
    );

    this.logger.debug('✅ Vertex event handlers registered');
  }

  /**
   * 注册属性事件处理器
   */
  private async registerPropertyEventHandlers(): Promise<void> {
    await this.eventBus.subscribe(
      EVENT_TYPES.PROPERTY_CREATED,
      this.handlePropertyCreated.bind(this),
    );

    await this.eventBus.subscribe(
      EVENT_TYPES.PROPERTY_UPDATED,
      this.handlePropertyUpdated.bind(this),
    );

    await this.eventBus.subscribe(
      EVENT_TYPES.PROPERTY_DELETED,
      this.handlePropertyDeleted.bind(this),
    );

    this.logger.debug('✅ Property event handlers registered');
  }

  /**
   * 注册边事件处理器
   */
  private async registerEdgeEventHandlers(): Promise<void> {
    await this.eventBus.subscribe(
      EVENT_TYPES.EDGE_CREATED,
      this.handleEdgeCreated.bind(this),
    );

    await this.eventBus.subscribe(
      EVENT_TYPES.EDGE_UPDATED,
      this.handleEdgeUpdated.bind(this),
    );

    await this.eventBus.subscribe(
      EVENT_TYPES.EDGE_DELETED,
      this.handleEdgeDeleted.bind(this),
    );

    this.logger.debug('✅ Edge event handlers registered');
  }

  // 实体事件处理方法
  private async handleEntityCreated(event: EntityCreatedEvent): Promise<void> {
    this.logger.log(
      `📝 Entity created: ${event.entityId} - ${event.data.nomenclature[0]?.name}`,
    );

    // 这里可以添加：
    // - 更新搜索索引
    // - 发送通知
    // - 更新缓存
    // - 记录统计信息
  }

  private async handleEntityUpdated(event: EntityUpdatedEvent): Promise<void> {
    this.logger.log(`📝 Entity updated: ${event.entityId}`);
  }

  private async handleEntityDeleted(event: EntityDeletedEvent): Promise<void> {
    this.logger.log(`📝 Entity deleted: ${event.entityId}`);
  }

  // 顶点事件处理方法
  private async handleVertexCreated(event: VertexCreatedEvent): Promise<void> {
    this.logger.log(
      `📍 Vertex created: ${event.vertexId} - ${event.data.type}`,
    );
  }

  private async handleVertexUpdated(event: VertexUpdatedEvent): Promise<void> {
    this.logger.log(`📍 Vertex updated: ${event.vertexId}`);
  }

  private async handleVertexDeleted(event: VertexDeletedEvent): Promise<void> {
    this.logger.log(`📍 Vertex deleted: ${event.vertexId}`);
  }

  // 属性事件处理方法
  private async handlePropertyCreated(
    event: PropertyCreatedEvent,
  ): Promise<void> {
    this.logger.log(`🔧 Property created: ${event.propertyId}`);
  }

  private async handlePropertyUpdated(
    event: PropertyUpdatedEvent,
  ): Promise<void> {
    this.logger.log(`🔧 Property updated: ${event.propertyId}`);
  }

  private async handlePropertyDeleted(
    event: PropertyDeletedEvent,
  ): Promise<void> {
    this.logger.log(`🔧 Property deleted: ${event.propertyId}`);
  }

  // 边事件处理方法
  private async handleEdgeCreated(event: EdgeCreatedEvent): Promise<void> {
    this.logger.log(`🔗 Edge created: ${event.edgeId} - ${event.data.type}`);
  }

  private async handleEdgeUpdated(event: EdgeUpdatedEvent): Promise<void> {
    this.logger.log(`🔗 Edge updated: ${event.edgeId}`);
  }

  private async handleEdgeDeleted(event: EdgeDeletedEvent): Promise<void> {
    this.logger.log(`🔗 Edge deleted: ${event.edgeId}`);
  }
}
