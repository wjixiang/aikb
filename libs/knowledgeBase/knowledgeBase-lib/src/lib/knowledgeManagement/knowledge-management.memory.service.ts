import { Injectable, Logger } from '@nestjs/common';
import { EntityStorageMemoryService } from '../knowledgeBaseStorage/entity-storage.memory.service';
import { VertexStorageMemoryService } from '../knowledgeBaseStorage/vertex-storage.memory.service';
import { PropertyStorageMemoryService } from '../knowledgeBaseStorage/property-storage.memory.service';
import { EdgeStorageMemoryService } from '../knowledgeBaseStorage/edge-storage.memory.service';
import { GitVersionControlService } from '../versionControl/version-control.service';
import { EventBusService } from '../events/event-bus.service';
import {
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
  EVENT_TYPES,
} from '../events/types';
import {
  IKnowledgeManagementService,
  OperationOptions,
  QueryOptions,
  BatchOperation,
  BatchOperationOptions,
  BatchResult,
  EntityWithRelations,
  RelationQueryOptions,
  EntityRelations,
  VertexConnections,
  ValidationResult,
  EntityQuery,
  VertexQuery,
  PropertyQuery,
  EdgeQuery,
} from './knowledge-management.interface';
import { EntityData, VertexData, PropertyData, EdgeData } from '../types';
import { EmbeddingService } from 'EmbeddingModule';

@Injectable()
export class KnowledgeManagementService implements IKnowledgeManagementService {
  private readonly logger = new Logger(KnowledgeManagementService.name);

  constructor(
    private readonly entityStorage: EntityStorageMemoryService,
    private readonly vertexStorage: VertexStorageMemoryService,
    private readonly propertyStorage: PropertyStorageMemoryService,
    private readonly edgeStorage: EdgeStorageMemoryService,
    private readonly eventBus: EventBusService,
    private readonly versionControl: GitVersionControlService,
    private readonly embeddingService: EmbeddingService,
  ) {}

  // 实体操作
  async createEntity(
    data: Omit<EntityData, 'id'>,
    options?: OperationOptions,
  ): Promise<EntityData> {
    this.logger.log(
      `Creating entity with nomenclature: ${data.nomanclature.map((n) => n.name).join(', ')}`,
    );

    // Generate embedding if not provided
    let entityData = { ...data };
    if (!entityData.abstract.embedding) {
      this.logger.log('Generating embedding for entity abstract...');

      // Get temporary config using getDefaultConfig
      const tempConfig = this.embeddingService.getDefaultConfig();
      this.logger.debug(
        'Using temporary config for embedding generation:',
        tempConfig,
      );

      const embeddingResult = await this.embeddingService.embed({
        text: entityData.abstract.description,
        provider: tempConfig.defaultProvider, // Use provider from temporary config
      });

      if (embeddingResult.success && embeddingResult.embedding) {
        entityData.abstract.embedding = {
          config: {
            model: tempConfig.defaultModel,
            dimension: embeddingResult.embedding.length,
            batchSize: tempConfig.defaultConcurrencyLimit,
            maxRetries: 3,
            timeout: 20000,
            provider: tempConfig.defaultProvider,
          },
          vector: embeddingResult.embedding,
        };
        this.logger.log(
          `Embedding generated successfully with ${embeddingResult.embedding.length} dimensions using provider: ${tempConfig.defaultProvider}`,
        );
      } else {
        this.logger.warn(
          `Failed to generate embedding for entity abstract: ${embeddingResult.error}`,
        );
        // Continue without embedding - it's optional now
      }
    }

    const entity = await this.entityStorage.create(entityData);

    // Publish event
    await this.eventBus.publish({
      eventId: `entity-created-${entity.id}`,
      eventType: EVENT_TYPES.ENTITY_CREATED,
      timestamp: new Date(),
      entityType: 'entity',
      entityId: entity.id,
      data: entity,
      userId: options?.userId,
    } as EntityCreatedEvent);

    // Create version control commit if needed
    if (options?.skipVersionControl !== true) {
      await this.versionControl.createCommit({
        repositoryId: 'knowledge-base',
        branchName: 'main',
        message: `Create entity: ${entity.nomanclature[0]?.name}`,
        author: { name: 'System', email: 'system@example.com' },
        changes: {
          added: [
            {
              path: `entities/${entity.id}`,
              objectId: entity.id,
              type: 'entity',
            },
          ],
          modified: [],
          deleted: [],
        },
      });
    }

    return entity;
  }

  async updateEntity(
    id: string,
    updates: Partial<EntityData>,
    options?: OperationOptions,
  ): Promise<EntityData> {
    this.logger.log(`Updating entity with id: ${id}`);

    const result = await this.entityStorage.update(id, updates);

    if (result) {
      // Get old data for the event
      const oldData = await this.entityStorage.findById(id);
      if (oldData) {
        // Publish update event
        await this.eventBus.publish({
          eventId: `entity-updated-${id}`,
          eventType: EVENT_TYPES.ENTITY_UPDATED,
          timestamp: new Date(),
          entityType: 'entity',
          entityId: id,
          oldData,
          newData: result,
          changes: updates,
          userId: options?.userId,
        } as EntityUpdatedEvent);
      }
      return result;
    }

    throw new Error(`Entity with id ${id} not found`);
  }

  async deleteEntity(id: string, options?: OperationOptions): Promise<boolean> {
    this.logger.log(`Deleting entity with id: ${id}`);

    const success = await this.entityStorage.delete(id);

    if (success) {
      // Get entity data for the event
      const entity = await this.entityStorage.findById(id);
      if (entity) {
        // Publish delete event
        await this.eventBus.publish({
          eventId: `entity-deleted-${id}`,
          eventType: EVENT_TYPES.ENTITY_DELETED,
          timestamp: new Date(),
          entityType: 'entity',
          entityId: id,
          data: entity,
          userId: options?.userId,
        } as EntityDeletedEvent);
      }
    }

    return success;
  }

  async getEntity(id: string): Promise<EntityData | null> {
    return await this.entityStorage.findById(id);
  }

  async findEntities(
    query: EntityQuery,
    options?: QueryOptions,
  ): Promise<EntityData[]> {
    // For now, implement basic search functionality
    if (query.textSearch) {
      return await this.entityStorage.search(query.textSearch, {
        limit: options?.limit,
        offset: options?.offset,
        language: query.languages?.[0],
      });
    }

    if (query.ids) {
      const results = await this.entityStorage.findByIds(query.ids);
      return results.filter((entity): entity is EntityData => entity !== null);
    }

    const result = await this.entityStorage.findAll(options);
    return result.entities;
  }

  // 顶点操作
  async createVertex(
    data: Omit<VertexData, 'id'>,
    options?: OperationOptions,
  ): Promise<VertexData> {
    this.logger.log(`Creating vertex with type: ${data.type}`);

    const vertex = await this.vertexStorage.create(data);

    // Publish event
    await this.eventBus.publish({
      eventId: `vertex-created-${vertex.id}`,
      eventType: EVENT_TYPES.VERTEX_CREATED,
      timestamp: new Date(),
      entityType: 'vertex',
      vertexId: vertex.id,
      data: vertex,
      userId: options?.userId,
    } as VertexCreatedEvent);

    return vertex;
  }

  async updateVertex(
    id: string,
    updates: Partial<VertexData>,
    options?: OperationOptions,
  ): Promise<VertexData> {
    this.logger.log(`Updating vertex with id: ${id}`);

    const result = await this.vertexStorage.update(id, updates);

    if (result) {
      // Get old data for the event
      const oldData = await this.vertexStorage.findById(id);
      if (oldData) {
        // Publish update event
        await this.eventBus.publish({
          eventId: `vertex-updated-${id}`,
          eventType: EVENT_TYPES.VERTEX_UPDATED,
          timestamp: new Date(),
          entityType: 'vertex',
          vertexId: id,
          oldData,
          newData: result,
          changes: updates,
          userId: options?.userId,
        } as VertexUpdatedEvent);
      }
      return result;
    }

    throw new Error(`Vertex with id ${id} not found`);
  }

  async deleteVertex(id: string, options?: OperationOptions): Promise<boolean> {
    this.logger.log(`Deleting vertex with id: ${id}`);

    const success = await this.vertexStorage.delete(id);

    if (success) {
      // Get vertex data for the event
      const vertex = await this.vertexStorage.findById(id);
      if (vertex) {
        // Publish delete event
        await this.eventBus.publish({
          eventId: `vertex-deleted-${id}`,
          eventType: EVENT_TYPES.VERTEX_DELETED,
          timestamp: new Date(),
          entityType: 'vertex',
          vertexId: id,
          data: vertex,
          userId: options?.userId,
        } as VertexDeletedEvent);
      }
    }

    return success;
  }

  async getVertex(id: string): Promise<VertexData | null> {
    return await this.vertexStorage.findById(id);
  }

  async findVertices(
    query: VertexQuery,
    options?: QueryOptions,
  ): Promise<VertexData[]> {
    if (query.contentSearch) {
      return await this.vertexStorage.search(query.contentSearch, {
        limit: options?.limit,
        offset: options?.offset,
      });
    }

    if (query.ids) {
      const results = await this.vertexStorage.findByIds(query.ids);
      return results.filter((vertex): vertex is VertexData => vertex !== null);
    }

    const result = await this.vertexStorage.findAll(options);
    return result.vertices;
  }

  // 属性操作
  async createProperty(
    data: Omit<PropertyData, 'id'>,
    options?: OperationOptions,
  ): Promise<PropertyData> {
    this.logger.log(
      `Creating property with content length: ${data.content.length}`,
    );

    const property = await this.propertyStorage.create(data);

    // Publish event
    await this.eventBus.publish({
      eventId: `property-created-${property.id}`,
      eventType: EVENT_TYPES.PROPERTY_CREATED,
      timestamp: new Date(),
      entityType: 'property',
      propertyId: property.id,
      data: property,
      userId: options?.userId,
    } as PropertyCreatedEvent);

    return property;
  }

  async updateProperty(
    id: string,
    updates: Partial<PropertyData>,
    options?: OperationOptions,
  ): Promise<PropertyData> {
    this.logger.log(`Updating property with id: ${id}`);

    const result = await this.propertyStorage.update(id, updates);

    if (result) {
      // Get old data for the event
      const oldData = await this.propertyStorage.findById(id);
      if (oldData) {
        // Publish update event
        await this.eventBus.publish({
          eventId: `property-updated-${id}`,
          eventType: EVENT_TYPES.PROPERTY_UPDATED,
          timestamp: new Date(),
          entityType: 'property',
          propertyId: id,
          oldData,
          newData: result,
          changes: updates,
          userId: options?.userId,
        } as PropertyUpdatedEvent);
      }
      return result;
    }

    throw new Error(`Property with id ${id} not found`);
  }

  async deleteProperty(
    id: string,
    options?: OperationOptions,
  ): Promise<boolean> {
    this.logger.log(`Deleting property with id: ${id}`);

    const success = await this.propertyStorage.delete(id);

    if (success) {
      // Get property data for the event
      const property = await this.propertyStorage.findById(id);
      if (property) {
        // Publish delete event
        await this.eventBus.publish({
          eventId: `property-deleted-${id}`,
          eventType: EVENT_TYPES.PROPERTY_DELETED,
          timestamp: new Date(),
          entityType: 'property',
          propertyId: id,
          data: property,
          userId: options?.userId,
        } as PropertyDeletedEvent);
      }
    }

    return success;
  }

  async getProperty(id: string): Promise<PropertyData | null> {
    return await this.propertyStorage.findById(id);
  }

  async findProperties(
    query: PropertyQuery,
    options?: QueryOptions,
  ): Promise<PropertyData[]> {
    if (query.ids) {
      const results = await this.propertyStorage.findByIds(query.ids);
      return results.filter(
        (property): property is PropertyData => property !== null,
      );
    }

    // For now, return empty array as search is not implemented for properties
    return [];
  }

  // 边操作
  async createEdge(
    data: Omit<EdgeData, 'id'>,
    options?: OperationOptions,
  ): Promise<EdgeData> {
    this.logger.log(
      `Creating edge with type: ${data.type} from ${data.in} to ${data.out}`,
    );

    const edge = await this.edgeStorage.create(data);

    // Publish event
    await this.eventBus.publish({
      eventId: `edge-created-${edge.id}`,
      eventType: EVENT_TYPES.EDGE_CREATED,
      timestamp: new Date(),
      entityType: 'edge',
      edgeId: edge.id,
      data: edge,
      userId: options?.userId,
    } as EdgeCreatedEvent);

    return edge;
  }

  async updateEdge(
    id: string,
    updates: Partial<EdgeData>,
    options?: OperationOptions,
  ): Promise<EdgeData> {
    this.logger.log(`Updating edge with id: ${id}`);

    const result = await this.edgeStorage.update(id, updates);

    if (result) {
      // Get old data for the event
      const oldData = await this.edgeStorage.findById(id);
      if (oldData) {
        // Publish update event
        await this.eventBus.publish({
          eventId: `edge-updated-${id}`,
          eventType: EVENT_TYPES.EDGE_UPDATED,
          timestamp: new Date(),
          entityType: 'edge',
          edgeId: id,
          oldData,
          newData: result,
          changes: updates,
          userId: options?.userId,
        } as EdgeUpdatedEvent);
      }
      return result;
    }

    throw new Error(`Edge with id ${id} not found`);
  }

  async deleteEdge(id: string, options?: OperationOptions): Promise<boolean> {
    this.logger.log(`Deleting edge with id: ${id}`);

    const success = await this.edgeStorage.delete(id);

    if (success) {
      // Get edge data for the event
      const edge = await this.edgeStorage.findById(id);
      if (edge) {
        // Publish delete event
        await this.eventBus.publish({
          eventId: `edge-deleted-${id}`,
          eventType: EVENT_TYPES.EDGE_DELETED,
          timestamp: new Date(),
          entityType: 'edge',
          edgeId: id,
          data: edge,
          userId: options?.userId,
        } as EdgeDeletedEvent);
      }
    }

    return success;
  }

  async getEdge(id: string): Promise<EdgeData | null> {
    return await this.edgeStorage.findById(id);
  }

  async findEdges(
    query: EdgeQuery,
    options?: QueryOptions,
  ): Promise<EdgeData[]> {
    if (query.ids) {
      const results = await this.edgeStorage.findByIds(query.ids);
      return results.filter((edge): edge is EdgeData => edge !== null);
    }

    const result = await this.edgeStorage.findAll(options);
    return result.edges;
  }

  // 批量操作
  async executeBatch(
    operations: BatchOperation[],
    options?: BatchOperationOptions,
  ): Promise<BatchResult> {
    this.logger.log(
      `Executing batch operations: ${operations.length} operations`,
    );

    const batchId = `batch-${Date.now()}`;
    const successful: Array<{ operation: BatchOperation; result: any }> = [];
    const failed: Array<{ operation: BatchOperation; error: Error }> = [];

    const startTime = Date.now();

    for (const operation of operations) {
      try {
        let result;
        switch (operation.type) {
          case 'create':
            switch (operation.entityType) {
              case 'entity':
                result = await this.createEntity(operation.data, options);
                break;
              case 'vertex':
                result = await this.createVertex(operation.data, options);
                break;
              case 'property':
                result = await this.createProperty(operation.data, options);
                break;
              case 'edge':
                result = await this.createEdge(operation.data, options);
                break;
            }
            break;
          case 'update':
            switch (operation.entityType) {
              case 'entity':
                result = await this.updateEntity(
                  operation.id!,
                  operation.updates!,
                  options,
                );
                break;
              case 'vertex':
                result = await this.updateVertex(
                  operation.id!,
                  operation.updates!,
                  options,
                );
                break;
              case 'property':
                result = await this.updateProperty(
                  operation.id!,
                  operation.updates!,
                  options,
                );
                break;
              case 'edge':
                result = await this.updateEdge(
                  operation.id!,
                  operation.updates!,
                  options,
                );
                break;
            }
            break;
          case 'delete':
            switch (operation.entityType) {
              case 'entity':
                result = await this.deleteEntity(operation.id!, options);
                break;
              case 'vertex':
                result = await this.deleteVertex(operation.id!, options);
                break;
              case 'property':
                result = await this.deleteProperty(operation.id!, options);
                break;
              case 'edge':
                result = await this.deleteEdge(operation.id!, options);
                break;
            }
            break;
          default:
            throw new Error(`Unknown operation type: ${operation.type}`);
        }
        successful.push({ operation, result });
      } catch (error) {
        this.logger.error(
          `Batch operation failed: ${(error as Error).message}`,
        );
        failed.push({ operation, error: error as Error });

        if (options?.stopOnError) {
          break;
        }
      }
    }

    const duration = Date.now() - startTime;

    return {
      batchId,
      successful,
      failed,
      totalProcessed: operations.length,
      totalSuccessful: successful.length,
      totalFailed: failed.length,
      duration,
      transactionId: options?.transactionId,
    };
  }

  // 复杂操作
  async createEntityWithRelations(
    entityData: Omit<EntityData, 'id'>,
    vertices: Omit<VertexData, 'id'>[],
    properties: Omit<PropertyData, 'id'>[],
    edges: Omit<EdgeData, 'id'>[],
    options?: OperationOptions,
  ): Promise<EntityWithRelations> {
    this.logger.log(
      `Creating entity with relations: ${entityData.nomanclature.map((n) => n.name).join(', ')}`,
    );

    // Create entity first
    const entity = await this.createEntity(entityData, options);

    // Create vertices
    const createdVertices = await Promise.all(
      vertices.map((vertexData) => this.createVertex(vertexData, options)),
    );

    // Create properties
    const createdProperties = await Promise.all(
      properties.map((propertyData) =>
        this.createProperty(propertyData, options),
      ),
    );

    // Create edges
    const createdEdges = await Promise.all(
      edges.map((edgeData) => this.createEdge(edgeData, options)),
    );

    return {
      entity,
      vertices: createdVertices,
      properties: createdProperties,
      edges: createdEdges,
      relations: {
        entityToVertices: createdEdges.filter((edge) =>
          createdVertices.some((v) => v.id === edge.in || v.id === edge.out),
        ),
        vertexToVertices: [],
        vertexToProperties: [],
      },
    };
  }

  // 关系查询
  async getEntityRelations(
    entityId: string,
    options?: RelationQueryOptions,
  ): Promise<EntityRelations> {
    // Get all edges and filter by entity
    const allEdges = await this.edgeStorage.findAll();
    const entityEdges = allEdges.edges.filter(
      (edge: EdgeData) => edge.in === entityId || edge.out === entityId,
    );

    const vertices: Array<{
      vertex: VertexData;
      edge: EdgeData;
      distance: number;
    }> = [];
    const properties: Array<{
      property: PropertyData;
      edge: EdgeData;
      distance: number;
    }> = [];
    const connectedEntities: Array<{
      entity: EntityData;
      path: EdgeData[];
      distance: number;
    }> = [];

    // For simplicity, implement basic relation logic
    for (const edge of entityEdges) {
      const distance = 1;

      // Find connected vertices
      if (options?.includeVertices !== false) {
        const vertexId = edge.in === entityId ? edge.out : edge.in;
        const vertex = await this.vertexStorage.findById(vertexId);
        if (vertex) {
          vertices.push({ vertex, edge, distance });
        }
      }
    }

    return {
      entityId,
      vertices,
      properties,
      connectedEntities,
    };
  }

  async getVertexConnections(
    vertexId: string,
    options?: RelationQueryOptions,
  ): Promise<VertexConnections> {
    const allEdges = await this.edgeStorage.findAll();

    const incomingEdges = allEdges.edges.filter(
      (edge: EdgeData) => edge.out === vertexId,
    );
    const outgoingEdges = allEdges.edges.filter(
      (edge: EdgeData) => edge.in === vertexId,
    );

    const connectedVertices: Array<{
      vertex: VertexData;
      edge: EdgeData;
      direction: 'incoming' | 'outgoing';
    }> = [];

    // Find connected vertices
    for (const edge of incomingEdges) {
      const vertex = await this.vertexStorage.findById(edge.in);
      if (vertex) {
        connectedVertices.push({ vertex, edge, direction: 'incoming' });
      }
    }

    for (const edge of outgoingEdges) {
      const vertex = await this.vertexStorage.findById(edge.out);
      if (vertex) {
        connectedVertices.push({ vertex, edge, direction: 'outgoing' });
      }
    }

    const relatedEntities: Array<{
      entity: EntityData;
      path: Array<VertexData | EdgeData>;
      distance: number;
    }> = [];

    return {
      vertexId,
      incomingEdges,
      outgoingEdges,
      connectedVertices,
      relatedEntities,
    };
  }

  // 验证操作
  async validateEntity(data: EntityData): Promise<ValidationResult> {
    const errors: any[] = [];
    const warnings: any[] = [];

    if (
      !data.nomanclature ||
      !Array.isArray(data.nomanclature) ||
      data.nomanclature.length === 0
    ) {
      errors.push({
        field: 'nomanclature',
        code: 'REQUIRED',
        message: 'Entity must have at least one nomenclature entry',
      });
    }

    if (!data.abstract || !data.abstract.description) {
      errors.push({
        field: 'abstract.description',
        code: 'REQUIRED',
        message: 'Entity must have abstract description',
      });
    }

    if (
      !data.abstract.embedding ||
      !Array.isArray(data.abstract.embedding.vector)
    ) {
      errors.push({
        field: 'abstract.embedding.vector',
        code: 'REQUIRED',
        message: 'Entity must have embedding vector',
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      severity:
        errors.length > 0 ? 'error' : warnings.length > 0 ? 'warning' : 'info',
    };
  }

  async validateVertex(data: VertexData): Promise<ValidationResult> {
    const errors: any[] = [];
    const warnings: any[] = [];

    if (!data.content) {
      errors.push({
        field: 'content',
        code: 'REQUIRED',
        message: 'Vertex must have content',
      });
    }

    if (
      !data.type ||
      !['concept', 'attribute', 'relationship'].includes(data.type)
    ) {
      errors.push({
        field: 'type',
        code: 'INVALID',
        message: 'Vertex must have valid type',
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      severity:
        errors.length > 0 ? 'error' : warnings.length > 0 ? 'warning' : 'info',
    };
  }

  async validateProperty(data: PropertyData): Promise<ValidationResult> {
    const errors: any[] = [];
    const warnings: any[] = [];

    if (!data.content) {
      errors.push({
        field: 'content',
        code: 'REQUIRED',
        message: 'Property must have content',
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      severity:
        errors.length > 0 ? 'error' : warnings.length > 0 ? 'warning' : 'info',
    };
  }

  async validateEdge(data: EdgeData): Promise<ValidationResult> {
    const errors: any[] = [];
    const warnings: any[] = [];

    if (!data.in || !data.out) {
      errors.push({
        field: 'in,out',
        code: 'REQUIRED',
        message: 'Edge must have both in and out references',
      });
    }

    if (!['start', 'middle', 'end'].includes(data.type)) {
      errors.push({
        field: 'type',
        code: 'INVALID',
        message: 'Edge must have valid type',
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      severity:
        errors.length > 0 ? 'error' : warnings.length > 0 ? 'warning' : 'info',
    };
  }
}
