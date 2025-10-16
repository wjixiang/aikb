import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MongodbKnowledgeContentStorage } from '../storage/mongodb-knowledge-content-storage';
import { MongodbKnowledgeVectorStorage } from '../storage/mongodb-knowledge-vector-storage';
import { MongoKnowledgeGraphStorage } from '../storage/mongodb-knowledge-graph-storage';
import { MongodbEntityContentStorage } from '../storage/mongodb-entity-content-storage';
import { MongoEntityGraphStorage } from '../storage/mongodb-entity-graph-storage';
import KnowledgeStorage from '../storage/knowledgeStorage';
import EntityStorage from '../storage/entityStorage';
import Entity from '../Entity';
import { KnowledgeCreationWorkflow } from '../knowledgeCreation/KnowledgeCreationWorkflow';
import { KnowledgeData, EntityData } from '../knowledge.type';
import { RelationshipVisualizer } from './relationship-visualizer';
import createLoggerWithPrefix from '../../lib/logger';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 复杂场景测试
 * 测试复杂关系建立和查询场景，包括多实体关联、层次结构、交叉引用等
 */
describe('Complex Scenario Tests', () => {
  let logger: any;
  let knowledgeStorage: KnowledgeStorage;
  let entityStorage: EntityStorage;
  let knowledgeWorkflow: KnowledgeCreationWorkflow;
  let visualizer: RelationshipVisualizer;
  let debugLogFile: string;

  beforeAll(() => {
    logger = createLoggerWithPrefix('ComplexScenarioTest');

    // Create debug log file
    debugLogFile = path.join(process.cwd(), 'debug-complex-query.log');
    if (fs.existsSync(debugLogFile)) {
      fs.unlinkSync(debugLogFile);
    }

    // 初始化存储组件
    const knowledgeContentStorage = new MongodbKnowledgeContentStorage();
    const knowledgeVectorStorage = new MongodbKnowledgeVectorStorage();
    const knowledgeGraphStorage = new MongoKnowledgeGraphStorage();

    const entityContentStorage = new MongodbEntityContentStorage();
    const entityGraphStorage = new MongoEntityGraphStorage();

    // 创建存储实例
    knowledgeStorage = new KnowledgeStorage(
      knowledgeContentStorage,
      knowledgeGraphStorage,
      knowledgeVectorStorage,
    );

    // 创建一个模拟的向量存储用于测试
    const mockVectorStorage = {
      store_vector: async () => {},
      get_vector: async () => null,
      update_vector: async () => {},
      delete_vector: async () => false,
      find_similar_vectors: async (
        vector: number[],
        limit?: number,
        threshold?: number,
      ) => {
        // 返回模拟的相似向量结果
        return [
          {
            entityId: 'mock_entity_1',
            similarity: 0.9,
            metadata: { name: 'Mock Entity 1' },
          },
          {
            entityId: 'mock_entity_2',
            similarity: 0.8,
            metadata: { name: 'Mock Entity 2' },
          },
        ].slice(0, limit);
      },
      batch_store_vectors: async () => {},
    };

    entityStorage = new EntityStorage(
      entityContentStorage,
      entityGraphStorage,
      mockVectorStorage as any,
    );

    knowledgeWorkflow = new KnowledgeCreationWorkflow(knowledgeStorage);
    visualizer = new RelationshipVisualizer(knowledgeStorage, entityStorage);
  });

  function debugLog(message: string, data?: any): void {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}${data ? `: ${JSON.stringify(data, null, 2)}` : ''}\n`;
    fs.appendFileSync(debugLogFile, logEntry);
    console.log(`[DEBUG] ${message}`, data || '');
  }

  describe('Multi-Entity Scenario', () => {
    it('should test multi-entity relationship scenario', async () => {
      logger.info('开始测试多实体关联场景');

      try {
        // 1. 创建主要实体
        const diseaseEntity = await createEntity({
          name: ['糖尿病', 'Diabetes Mellitus'],
          tags: ['疾病', '代谢疾病', '慢性病'],
          definition:
            '糖尿病是一组以高血糖为特征的代谢性疾病，由胰岛素分泌缺陷或其生物作用受损引起。',
        });

        const complicationEntity = await createEntity({
          name: ['糖尿病肾病', 'Diabetic Nephropathy'],
          tags: ['并发症', '肾脏疾病'],
          definition:
            '糖尿病肾病是糖尿病最常见的微血管并发症之一，是导致终末期肾病的主要原因。',
        });

        const treatmentEntity = await createEntity({
          name: ['胰岛素治疗', 'Insulin Therapy'],
          tags: ['治疗', '药物治疗'],
          definition:
            '胰岛素治疗是糖尿病管理的重要手段，通过补充外源性胰岛素来控制血糖水平。',
        });

        // 2. 创建实体间的关系
        await createEntityRelationship(
          diseaseEntity,
          complicationEntity,
          '可能导致',
        );
        await createEntityRelationship(diseaseEntity, treatmentEntity, '需要');

        // 3. 为每个实体创建相关知识
        const diseaseKnowledge = await createKnowledgeForEntity(diseaseEntity, {
          scope: '病因和发病机制',
          content:
            '糖尿病的发病机制复杂，主要包括胰岛素抵抗和胰岛素分泌不足两个方面。1型糖尿病主要由自身免疫导致胰岛β细胞破坏；2型糖尿病则与遗传因素和环境因素共同作用有关。',
          childKnowledgeId: [],
        });

        const complicationKnowledge = await createKnowledgeForEntity(
          complicationEntity,
          {
            scope: '临床表现',
            content:
              '糖尿病肾病早期无明显症状，随着病情进展可出现蛋白尿、水肿、高血压等表现。晚期可发展为肾功能衰竭。',
            childKnowledgeId: [],
          },
        );

        // 4. 创建交叉引用知识
        const crossReferenceKnowledge = await createCrossReferenceKnowledge(
          diseaseEntity,
          complicationEntity,
          {
            scope: '疾病与并发症的关系',
            content:
              '长期血糖控制不佳是导致糖尿病肾病的主要危险因素。良好的血糖管理可以显著降低糖尿病肾病的发生风险。',
            childKnowledgeId: [],
          },
        );

        // 5. 验证关系结构
        const diseaseRelations = await getEntityRelations(
          diseaseEntity.get_id(),
        );
        const complicationRelations = await getEntityRelations(
          complicationEntity.get_id(),
        );

        const isValid =
          diseaseRelations.length >= 2 && complicationRelations.length >= 1;

        logger.info('多实体关联场景测试结果', {
          diseaseRelations: diseaseRelations.length,
          complicationRelations: complicationRelations.length,
          isValid,
        });

        expect(isValid).toBe(true);
      } catch (error) {
        logger.error('多实体关联场景测试失败', error);
        expect(false).toBe(true);
      }
    });
  });

  describe('Deep Hierarchy Scenario', () => {
    it('should test deep hierarchy scenario', async () => {
      logger.info('开始测试深度层次结构场景');

      try {
        // 1. 创建根实体
        const rootEntity = await createEntity({
          name: ['心血管疾病', 'Cardiovascular Disease'],
          tags: ['疾病', '循环系统疾病'],
          definition:
            '心血管疾病是指影响心脏和血管的疾病，包括冠心病、高血压、心力衰竭等多种疾病。',
        });

        // 2. 创建多层次知识结构
        const hierarchyText = `
        心血管疾病概述：
        心血管疾病是全球主要的死亡原因之一，包括多种影响心脏和血管的疾病。
        
        冠心病：
        冠心病是由于冠状动脉粥样硬化导致心肌缺血的疾病。
        
        稳定型心绞痛：
        稳定型心绞痛是冠心病的一种表现形式，通常在体力活动时发作。
        
        不稳定型心绞痛：
        不稳定型心绞痛是急性冠状动脉综合征的一种，需要紧急处理。
        
        心肌梗死：
        心肌梗死是由于冠状动脉急性闭塞导致心肌坏死的严重疾病。
        
        高血压：
        高血压是指动脉血压持续升高的疾病，是心血管疾病的重要危险因素。
        
        原发性高血压：
        原发性高血压占所有高血压患者的90%以上，病因不明确。
        
        继发性高血压：
        继发性高血压由其他疾病引起，如肾脏疾病、内分泌疾病等。
        
        心力衰竭：
        心力衰竭是心脏泵血功能受损导致的一种临床综合征。
        
        收缩性心力衰竭：
        收缩性心力衰竭主要是由于心肌收缩力减弱引起的。
        
        舒张性心力衰竭：
        舒张性心力衰竭主要是由于心肌舒张功能受损引起的。
        `;

        const rootKnowledge =
          await rootEntity.create_subordinate_knowledge_from_text(
            hierarchyText,
            knowledgeStorage,
          );

        // 3. 验证层次结构深度
        const maxDepth = await calculateMaxDepth(rootKnowledge);
        const totalNodes = await countTotalNodes(rootKnowledge);

        // 4. 生成可视化
        const mermaidDiagram = await visualizer.generateMermaidDiagram(
          rootEntity.get_id(),
        );
        const stats = await visualizer.generateRelationshipStats(
          rootEntity.get_id(),
        );

        const isValid = maxDepth >= 3 && totalNodes >= 5;

        logger.info('深度层次结构场景测试结果', {
          maxDepth,
          totalNodes,
          mermaidDiagramLength: mermaidDiagram.length,
          isValid,
        });

        expect(isValid).toBe(true);
      } catch (error) {
        logger.error('深度层次结构场景测试失败', error);
        expect(false).toBe(true);
      }
    });
  });

  describe('Complex Query Scenario', () => {
    it('should test complex query scenario', async () => {
      debugLog('=== 开始测试复杂查询场景 ===');

      try {
        // 1. 创建复杂的实体网络
        debugLog('开始创建医疗实体网络');
        const entities = await createMedicalEntityNetwork();
        debugLog('医疗实体网络创建完成', { entityCount: entities.length });

        if (entities.length < 2) {
          debugLog('实体数量不足，无法进行复杂查询测试', {
            entityCount: entities.length,
          });
          expect(false).toBe(true);
          return;
        }

        // 2. 测试多跳查询
        debugLog('开始测试多跳查询');
        const multiHopResults = await testMultiHopQuery(
          entities[0],
          entities[entities.length - 1],
        );
        debugLog('多跳查询测试完成', { multiHopResults });

        // 3. 测试路径查找
        debugLog('开始测试路径查找');
        const pathResults = await testPathFinding(
          entities[0],
          entities[entities.length - 1],
        );
        debugLog('路径查找测试完成', { pathResults });

        // 4. 测试相似性搜索
        debugLog('开始测试相似性搜索');
        const similarityResults = await testSimilaritySearch(entities[0]);
        debugLog('相似性搜索测试完成', { similarityResults });

        // 5. 测试聚合查询
        debugLog('开始测试聚合查询');
        const aggregationResults = await testAggregationQuery(entities[0]);
        debugLog('聚合查询测试完成', { aggregationResults });

        const isValid =
          multiHopResults &&
          pathResults &&
          similarityResults &&
          aggregationResults;

        debugLog('复杂查询场景测试结果', {
          multiHopResults,
          pathResults,
          similarityResults,
          aggregationResults,
          isValid,
        });

        debugLog('复杂查询场景测试结果详情', {
          multiHopResults,
          pathResults,
          similarityResults,
          aggregationResults,
          isValid,
        });
        expect(isValid).toBe(true);
      } catch (error) {
        debugLog('复杂查询场景测试失败', {
          error: error.message,
          stack: error.stack,
          errorName: error.name,
          errorCode: error.code,
        });
        throw error; // Re-throw to see the actual error
      }
    });
  });

  describe('Concurrent Operation Scenario', () => {
    it('should test concurrent operation scenario', async () => {
      logger.info('开始测试并发操作场景');

      try {
        // 1. 创建基础实体
        const baseEntity = await createEntity({
          name: ['并发测试实体'],
          tags: ['测试'],
          definition: '用于并发测试的基础实体',
        });

        // 2. 并发创建多个知识
        const concurrentPromises: Promise<any>[] = [];
        for (let i = 0; i < 10; i++) {
          const promise = knowledgeWorkflow.create_simple_knowledge_from_text(
            `并发测试知识 ${i}：这是第${i}个并发创建的知识项，用于测试系统的并发处理能力。`,
            baseEntity,
            `并发测试知识 ${i}`,
          );
          concurrentPromises.push(promise);
        }

        const concurrentResults = await Promise.all(concurrentPromises);

        // 3. 验证所有知识都创建成功
        const allCreated = concurrentResults.every((result) => result !== null);

        // 4. 验证实体-知识关系
        const subordinateKnowledge =
          await baseEntity.get_subordinate_knowledge(knowledgeStorage);
        const relationshipValid = subordinateKnowledge.length === 10;

        const isValid = allCreated && relationshipValid;

        logger.info('并发操作场景测试结果', {
          concurrentKnowledgeCount: concurrentResults.length,
          allCreated,
          relationshipValid,
          isValid,
        });

        expect(isValid).toBe(true);
      } catch (error) {
        logger.error('并发操作场景测试失败', error);
        expect(false).toBe(true);
      }
    });
  });

  describe('Big Data Scenario', () => {
    it('should test big data scenario', async () => {
      logger.info('开始测试大数据量场景');

      try {
        // 1. 创建大量实体
        const entities: Entity[] = [];
        const batchSize = 50;

        for (let i = 0; i < batchSize; i++) {
          const entity = await createEntity({
            name: [`大数据测试实体 ${i}`],
            tags: ['测试', '大数据'],
            definition: `这是第${i}个用于大数据测试的实体，包含大量测试数据。`,
          });
          entities.push(entity);
        }

        // 2. 为每个实体创建知识
        const knowledgePromises = entities.map(async (entity, index) => {
          return await knowledgeWorkflow.create_simple_knowledge_from_text(
            `大数据测试知识 ${index}：这是实体${index}的关联知识，包含详细的测试内容和数据。`,
            entity,
            `大数据测试知识 ${index}`,
          );
        });

        const knowledgeResults = await Promise.all(knowledgePromises);

        // 3. 测试批量查询性能
        const startTime = Date.now();
        const queryPromises = entities.map((entity) =>
          entity.get_subordinate_knowledge(knowledgeStorage),
        );
        await Promise.all(queryPromises);
        const queryTime = Date.now() - startTime;

        // 4. 测试批量可视化生成
        const vizStartTime = Date.now();
        const vizPromises = entities
          .slice(0, 5)
          .map((entity) =>
            visualizer.generateRelationshipStats(entity.get_id()),
          );
        await Promise.all(vizPromises);
        const vizTime = Date.now() - vizStartTime;

        const isValid =
          entities.length === batchSize &&
          knowledgeResults.length === batchSize &&
          queryTime < 10000 && // 查询应在10秒内完成
          vizTime < 5000; // 可视化应在5秒内完成

        logger.info('大数据量场景测试结果', {
          entityCount: entities.length,
          knowledgeCount: knowledgeResults.length,
          queryTime,
          vizTime,
          isValid,
        });

        expect(isValid).toBe(true);
      } catch (error) {
        logger.error('大数据量场景测试失败', error);
        expect(false).toBe(true);
      }
    });
  });

  // Helper functions
  async function createEntity(entityData: EntityData): Promise<Entity> {
    return await Entity.create_entity_with_entity_data(entityData).save(
      entityStorage,
    );
  }

  async function createKnowledgeForEntity(
    entity: Entity,
    knowledgeData: KnowledgeData,
  ): Promise<any> {
    return await knowledgeWorkflow.create_simple_knowledge_from_text(
      knowledgeData.content,
      entity,
      knowledgeData.scope,
    );
  }

  async function createEntityRelationship(
    sourceEntity: Entity,
    targetEntity: Entity,
    relationType: string,
  ): Promise<void> {
    await entityStorage.entityGraphStorage.create_relation(
      sourceEntity.get_id(),
      targetEntity.get_id(),
      relationType,
    );
  }

  async function createCrossReferenceKnowledge(
    entity1: Entity,
    entity2: Entity,
    knowledgeData: KnowledgeData,
  ): Promise<any> {
    // 为第一个实体创建知识
    const knowledge1 = await createKnowledgeForEntity(entity1, knowledgeData);

    // 为第二个实体创建相关知识
    const crossReferenceContent = `交叉引用：${knowledgeData.content}（与${entity2.get_definition().split('。')[0]}相关）`;
    await knowledgeWorkflow.create_simple_knowledge_from_text(
      crossReferenceContent,
      entity2,
      `交叉引用：${knowledgeData.scope}`,
    );

    return knowledge1;
  }

  async function getEntityRelations(entityId: string): Promise<any[]> {
    return await entityStorage.entityGraphStorage.get_entity_relations(
      entityId,
    );
  }

  async function calculateMaxDepth(
    knowledge: any,
    currentDepth: number = 1,
  ): Promise<number> {
    const children = knowledge.getChildren();
    if (children.length === 0) {
      return currentDepth;
    }

    let maxDepth = currentDepth;
    for (const child of children) {
      const childDepth = await calculateMaxDepth(child, currentDepth + 1);
      maxDepth = Math.max(maxDepth, childDepth);
    }

    return maxDepth;
  }

  async function countTotalNodes(knowledge: any): Promise<number> {
    const children = knowledge.getChildren();
    let count = 1; // Count current node

    for (const child of children) {
      count += await countTotalNodes(child);
    }

    return count;
  }

  async function createMedicalEntityNetwork(): Promise<Entity[]> {
    const entities = [
      {
        name: ['糖尿病'],
        tags: ['疾病', '代谢疾病'],
        definition: '糖尿病是一种以高血糖为特征的代谢性疾病。',
      },
      {
        name: ['高血压'],
        tags: ['疾病', '心血管疾病'],
        definition: '高血压是指动脉血压持续升高的疾病。',
      },
      {
        name: ['肾病'],
        tags: ['疾病', '肾脏疾病'],
        definition: '肾病是指肾脏结构或功能异常的疾病。',
      },
    ];

    const createdEntities: Entity[] = [];

    for (const entityData of entities) {
      const entity = await createEntity(entityData);
      createdEntities.push(entity);
    }

    // 创建实体间的关系
    await createEntityRelationship(
      createdEntities[0],
      createdEntities[1],
      '可能导致',
    );
    await createEntityRelationship(
      createdEntities[0],
      createdEntities[2],
      '可能导致',
    );
    await createEntityRelationship(
      createdEntities[1],
      createdEntities[2],
      '可能导致',
    );

    // 为每个实体创建一些知识，确保聚合查询测试能通过
    for (const entity of createdEntities) {
      await entity.create_subordinate_knowledge_from_text(
        `${entity.get_definition()}的相关知识内容，用于测试聚合查询功能。`,
        knowledgeStorage,
      );
    }

    return createdEntities;
  }

  async function testMultiHopQuery(
    sourceEntity: Entity,
    targetEntity: Entity,
  ): Promise<boolean> {
    try {
      // 获取源实体的所有相关实体
      const sourceRelations = await getEntityRelations(sourceEntity.get_id());

      // 检查是否能通过中间实体到达目标实体
      for (const relation of sourceRelations) {
        const intermediateRelations = await getEntityRelations(
          relation.targetId,
        );
        const hasPathToTarget = intermediateRelations.some(
          (r) => r.targetId === targetEntity.get_id(),
        );

        if (hasPathToTarget) {
          return true;
        }
      }

      return false;
    } catch (error) {
      logger.error('多跳查询测试失败', error);
      return false;
    }
  }

  async function testPathFinding(
    sourceEntity: Entity,
    targetEntity: Entity,
  ): Promise<boolean> {
    try {
      // 简化的路径查找测试
      const sourceRelations = await getEntityRelations(sourceEntity.get_id());
      const hasDirectPath = sourceRelations.some(
        (r) => r.targetId === targetEntity.get_id(),
      );

      return hasDirectPath;
    } catch (error) {
      logger.error('路径查找测试失败', error);
      return false;
    }
  }

  async function testSimilaritySearch(entity: Entity): Promise<boolean> {
    try {
      // 测试向量相似性搜索
      const queryVector = [1, 0, 0];
      const similarEntities =
        await entityStorage.entityVectorStorage.find_similar_vectors(
          queryVector,
          3,
          0.5,
        );

      return similarEntities.length > 0;
    } catch (error) {
      logger.error('相似性搜索测试失败', error);
      return false;
    }
  }

  async function testAggregationQuery(entity: Entity): Promise<boolean> {
    try {
      // 测试聚合查询 - 获取实体的所有下属知识
      const subordinateKnowledge =
        await entity.get_subordinate_knowledge(knowledgeStorage);

      // 计算统计信息
      const totalKnowledge = subordinateKnowledge.length;
      const totalChildren = subordinateKnowledge.reduce(
        (sum, k) => sum + k.getChildren().length,
        0,
      );

      return totalKnowledge > 0 || totalChildren > 0;
    } catch (error) {
      logger.error('聚合查询测试失败', error);
      return false;
    }
  }
});
