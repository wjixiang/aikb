import { Injectable, Logger } from '@nestjs/common';
import {
  EntityStorageMemoryService,
  VertexStorageMemoryService,
  PropertyStorageMemoryService,
  EdgeStorageMemoryService,
  GitVersionControlService
} from 'knowledgeBase-lib';
import {
  CreateEntityDto,
  CreateVertexDto,
  CreatePropertyDto,
  CreateEdgeDto,
  SearchDto
} from '../dto';
import { EventBusService } from '../events/event-bus.service';
import { OpenAIModel } from 'embedding';

@Injectable()
export class KnowledgeManagementService {
  private readonly logger = new Logger(KnowledgeManagementService.name);

  constructor(
    private readonly entityStorage: EntityStorageMemoryService,
    private readonly vertexStorage: VertexStorageMemoryService,
    private readonly propertyStorage: PropertyStorageMemoryService,
    private readonly edgeStorage: EdgeStorageMemoryService,
    private readonly eventBus: EventBusService,
    private readonly versionControl: GitVersionControlService,
  ) {}

  async createEntity(createEntityDto: CreateEntityDto, options?: any) {
    this.logger.log(`Creating entity with nomenclature: ${createEntityDto.nomenclature.map(n => n.name).join(', ')}`);
    
    // Convert DTO to entity data format
    const entityData = {
      nomanclature: createEntityDto.nomenclature.map(n => ({
        name: n.name,
        acronym: n.acronym || null,
        language: n.language
      })),
      abstract: {
        description: createEntityDto.abstract.description,
        embedding: {
          config: {
            model: createEntityDto.abstract.embedding.model as OpenAIModel,
            dimension: createEntityDto.abstract.embedding.dimensions,
            batchSize: 20,
            maxRetries: 3,
            timeout: 20000,
            provider: 'openai' as any // Default provider
          },
          vector: createEntityDto.abstract.embedding.vector
        }
      },
    };

    const entity = await this.entityStorage.create(entityData);

    // Publish event
    await this.eventBus.publish({
      eventId: `entity-created-${entity.id}`,
      eventType: 'entity.created',
      timestamp: new Date(),
      entityType: 'entity',
      entityId: entity.id,
      data: entity,
      userId: options?.userId
    });

    // Create version control commit if needed
    if (options?.autoCommit) {
      await this.versionControl.createCommit({
        repositoryId: 'knowledge-base',
        branchName: options.branchName || 'main',
        message: `Create entity: ${entity.nomanclature[0]?.name}`,
        author: { name: options.authorName || 'System', email: options.authorEmail || 'system@example.com' },
        changes: {
          added: [{
            path: `entities/${entity.id}`,
            objectId: entity.id,
            type: 'entity'
          }],
          modified: [],
          deleted: []
        }
      });
    }

    return entity;
  }

  async createVertex(createVertexDto: CreateVertexDto, options?: any) {
    this.logger.log(`Creating vertex with type: ${createVertexDto.type}`);
    
    const vertexData = {
      content: createVertexDto.content,
      type: createVertexDto.type,
      metadata: createVertexDto.metadata,
    };

    const vertex = await this.vertexStorage.create(vertexData);

    // Publish event
    await this.eventBus.publish({
      eventId: `vertex-created-${vertex.id}`,
      eventType: 'vertex.created',
      timestamp: new Date(),
      entityType: 'vertex',
      vertexId: vertex.id,
      data: vertex,
      userId: options?.userId
    });

    return vertex;
  }

  async createProperty(createPropertyDto: CreatePropertyDto, options?: any) {
    this.logger.log(`Creating property with content length: ${createPropertyDto.content.length}`);
    
    const propertyData = {
      content: createPropertyDto.content,
    };

    const property = await this.propertyStorage.create(propertyData);

    // Publish event
    await this.eventBus.publish({
      eventId: `property-created-${property.id}`,
      eventType: 'property.created',
      timestamp: new Date(),
      entityType: 'property',
      propertyId: property.id,
      data: property,
      userId: options?.userId
    });

    return property;
  }

  async createEdge(createEdgeDto: CreateEdgeDto, options?: any) {
    this.logger.log(`Creating edge with type: ${createEdgeDto.type} from ${createEdgeDto.in} to ${createEdgeDto.out}`);
    
    const edgeData = {
      type: createEdgeDto.type,
      in: createEdgeDto.in,
      out: createEdgeDto.out,
    };

    const edge = await this.edgeStorage.create(edgeData);

    // Publish event
    await this.eventBus.publish({
      eventId: `edge-created-${edge.id}`,
      eventType: 'edge.created',
      timestamp: new Date(),
      entityType: 'edge',
      edgeId: edge.id,
      data: edge,
      userId: options?.userId
    });

    return edge;
  }

  async createEntityWithRelations(
    createEntityDto: CreateEntityDto,
    verticesData: CreateVertexDto[],
    propertiesData: CreatePropertyDto[],
    edgesData: CreateEdgeDto[],
    options?: any
  ) {
    this.logger.log(`Creating entity with relations: ${createEntityDto.nomenclature.map(n => n.name).join(', ')}`);
    
    // Create entity first
    const entity = await this.createEntity(createEntityDto, options);
    
    // Create vertices
    const vertices = await Promise.all(
      verticesData.map(vertexDto => this.createVertex(vertexDto, options))
    );
    
    // Create properties
    const properties = await Promise.all(
      propertiesData.map(propertyDto => this.createProperty(propertyDto, options))
    );
    
    // Create edges
    const edges = await Promise.all(
      edgesData.map(edgeDto => this.createEdge(edgeDto, options))
    );

    return {
      entity,
      vertices,
      properties,
      edges
    };
  }

  async executeBatch(operations: any[], options?: any) {
    this.logger.log(`Executing batch operations: ${operations.length} operations`);
    
    const results: any[] = [];
    
    for (const operation of operations) {
      try {
        let result;
        switch (operation.type) {
          case 'createEntity':
            result = await this.createEntity(operation.data, options);
            break;
          case 'createVertex':
            result = await this.createVertex(operation.data, options);
            break;
          case 'createProperty':
            result = await this.createProperty(operation.data, options);
            break;
          case 'createEdge':
            result = await this.createEdge(operation.data, options);
            break;
          default:
            result = { error: `Unknown operation type: ${operation.type}` };
        }
        results.push({ success: true, result, operation });
      } catch (error) {
        this.logger.error(`Batch operation failed: ${error.message}`);
        results.push({ success: false, error: error.message, operation });
      }
    }

    return {
      results,
      successCount: results.filter(r => r.success).length,
      failureCount: results.filter(r => !r.success).length
    };
  }

  async search(searchDto: SearchDto, options?: any) {
    this.logger.log(`Searching entities with query: ${searchDto.query}`);
    
    // Search entities
    const entities = await this.entityStorage.search(searchDto.query, {
      limit: searchDto.limit,
      offset: searchDto.offset,
      language: searchDto.language
    });

    // Search vertices
    const vertices = await this.vertexStorage.search(searchDto.query, {
      limit: searchDto.limit,
      offset: searchDto.offset
    });

    // Search properties - using findByIds since search is not available
    // For now, return empty array as search is not implemented
    const properties: any[] = [];

    return {
      entities,
      vertices,
      properties,
      total: entities.length + vertices.length + properties.length
    };
  }

  async findById(id: string, type: 'entity' | 'vertex' | 'property' | 'edge', options?: any) {
    switch (type) {
      case 'entity':
        return await this.entityStorage.findById(id);
      case 'vertex':
        return await this.vertexStorage.findById(id);
      case 'property':
        return await this.propertyStorage.findById(id);
      case 'edge':
        return await this.edgeStorage.findById(id);
      default:
        throw new Error(`Unknown type: ${type}`);
    }
  }

  async findByIds(ids: string[], type: 'entity' | 'vertex' | 'property' | 'edge', options?: any) {
    switch (type) {
      case 'entity':
        return await this.entityStorage.findByIds(ids);
      case 'vertex':
        return await this.vertexStorage.findByIds(ids);
      case 'property':
        return await this.propertyStorage.findByIds(ids);
      case 'edge':
        return await this.edgeStorage.findByIds(ids);
      default:
        throw new Error(`Unknown type: ${type}`);
    }
  }

  async update(id: string, updates: any, type: 'entity' | 'vertex' | 'property' | 'edge', options?: any) {
    this.logger.log(`Updating ${type} with id: ${id}`);
    
    let result;
    switch (type) {
      case 'entity':
        result = await this.entityStorage.update(id, updates);
        break;
      case 'vertex':
        result = await this.vertexStorage.update(id, updates);
        break;
      case 'property':
        result = await this.propertyStorage.update(id, updates);
        break;
      case 'edge':
        result = await this.edgeStorage.update(id, updates);
        break;
      default:
        throw new Error(`Unknown type: ${type}`);
    }

    if (result) {
      // Publish update event
      await this.eventBus.publish({
        eventId: `${type}-updated-${id}`,
        eventType: `${type}.updated`,
        timestamp: new Date(),
        entityType: type,
        [`${type}Id`]: id,
        data: result,
        userId: options?.userId
      });
    }

    return result;
  }

  async delete(id: string, type: 'entity' | 'vertex' | 'property' | 'edge', options?: any) {
    this.logger.log(`Deleting ${type} with id: ${id}`);
    
    let success;
    switch (type) {
      case 'entity':
        success = await this.entityStorage.delete(id);
        break;
      case 'vertex':
        success = await this.vertexStorage.delete(id);
        break;
      case 'property':
        success = await this.propertyStorage.delete(id);
        break;
      case 'edge':
        success = await this.edgeStorage.delete(id);
        break;
      default:
        throw new Error(`Unknown type: ${type}`);
    }

    if (success) {
      // Publish delete event
      await this.eventBus.publish({
        eventId: `${type}-deleted-${id}`,
        eventType: `${type}.deleted`,
        timestamp: new Date(),
        entityType: type,
        [`${type}Id`]: id,
        data: { id },
        userId: options?.userId
      });
    }

    return success;
  }

  async exists(id: string, type: 'entity' | 'vertex' | 'property' | 'edge'): Promise<boolean> {
    switch (type) {
      case 'entity':
        return await this.entityStorage.exists(id);
      case 'vertex':
        return await this.vertexStorage.exists(id);
      case 'property':
        return await this.propertyStorage.exists(id);
      case 'edge':
        return await this.edgeStorage.exists(id);
      default:
        throw new Error(`Unknown type: ${type}`);
    }
  }

  async findBySimilarity(vector: number[], options?: any) {
    this.logger.log(`Finding entities by similarity with threshold: ${options?.threshold}`);
    
    const results = await this.entityStorage.findBySimilarity(vector, {
      limit: options?.limit,
      threshold: options?.threshold
    });

    return results;
  }

  async findAll(type: 'entity' | 'vertex' | 'property' | 'edge', options?: any) {
    switch (type) {
      case 'entity':
        return await this.entityStorage.findAll(options);
      case 'vertex':
        return await this.vertexStorage.findAll(options);
      case 'property':
        // Property storage doesn't have findAll, return empty result
        return { properties: [], total: 0 };
      case 'edge':
        return await this.edgeStorage.findAll(options);
      default:
        throw new Error(`Unknown type: ${type}`);
    }
  }

  async validate(data: any, type: 'entity' | 'vertex' | 'property' | 'edge'): Promise<{ isValid: boolean; errors: string[] }> {
    // Basic validation logic
    const errors: string[] = [];
    
    switch (type) {
      case 'entity':
        if (!data.nomenclature || !Array.isArray(data.nomenclature) || data.nomenclature.length === 0) {
          errors.push('Entity must have at least one nomenclature entry');
        }
        if (!data.abstract || !data.abstract.description) {
          errors.push('Entity must have abstract description');
        }
        if (!data.abstract.embedding || !Array.isArray(data.abstract.embedding.vector)) {
          errors.push('Entity must have embedding vector');
        }
        break;
      case 'vertex':
        if (!data.content) {
          errors.push('Vertex must have content');
        }
        if (!data.type || !['concept', 'attribute', 'relationship'].includes(data.type)) {
          errors.push('Vertex must have valid type');
        }
        break;
      case 'property':
        if (!data.content) {
          errors.push('Property must have content');
        }
        break;
      case 'edge':
        if (!data.in || !data.out) {
          errors.push('Edge must have both in and out references');
        }
        if (!['start', 'middle', 'end'].includes(data.type)) {
          errors.push('Edge must have valid type');
        }
        break;
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  async findByEdgeType(type: 'start' | 'middle' | 'end', options?: any) {
    this.logger.log(`Finding edges by type: ${type}`);
    
    // Get all edges and filter by type
    const allEdges = await this.edgeStorage.findAll(options);
    const filteredEdges = allEdges.edges.filter(edge => edge.type === type);
    
    return {
      edges: filteredEdges,
      total: filteredEdges.length
    };
  }

  async findByNodes(inId: string, outId: string) {
    this.logger.log(`Finding edges between nodes: ${inId} -> ${outId}`);
    
    // Get all edges and filter by nodes
    const allEdges = await this.edgeStorage.findAll();
    const filteredEdges = allEdges.edges.filter(edge =>
      edge.in === inId && edge.out === outId
    );
    
    return {
      edges: filteredEdges,
      total: filteredEdges.length
    };
  }
}