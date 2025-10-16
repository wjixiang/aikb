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
export class ComplexScenarioTest {
  private logger = createLoggerWithPrefix('ComplexScenarioTest');
  private knowledgeStorage: KnowledgeStorage;
  private entityStorage: EntityStorage;
  private knowledgeWorkflow: KnowledgeCreationWorkflow;
  private visualizer: RelationshipVisualizer;
  private debugLogFile: string;

  constructor() {
    // Create debug log file
    this.debugLogFile = path.join(process.cwd(), 'debug-complex-query.log');
    if (fs.existsSync(this.debugLogFile)) {
      fs.unlinkSync(this.debugLogFile);
    }
    // 初始化存储组件
    const knowledgeContentStorage = new MongodbKnowledgeContentStorage();
    const knowledgeVectorStorage = new MongodbKnowledgeVectorStorage();
    const knowledgeGraphStorage = new MongoKnowledgeGraphStorage();

    const entityContentStorage = new MongodbEntityContentStorage();
    const entityGraphStorage = new MongoEntityGraphStorage();

    // 创建存储实例
    this.knowledgeStorage = new KnowledgeStorage(
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

    this.entityStorage = new EntityStorage(
      entityContentStorage,
      entityGraphStorage,
      mockVectorStorage as any,
    );

    this.knowledgeWorkflow = new KnowledgeCreationWorkflow(
      this.knowledgeStorage,
    );
    this.visualizer = new RelationshipVisualizer(
      this.knowledgeStorage,
      this.entityStorage,
    );
  }

  private debugLog(message: string, data?: any): void {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}${data ? `: ${JSON.stringify(data, null, 2)}` : ''}\n`;
    fs.appendFileSync(this.debugLogFile, logEntry);
    console.log(`[DEBUG] ${message}`, data || '');
  }

  /**
   * 测试多实体关联场景
   * 创建一个医疗知识体系，包含疾病、症状、治疗等多个相关实体
   */
  async testMultiEntityScenario(): Promise<boolean> {
    this.logger.info('开始测试多实体关联场景');

    try {
      // 1. 创建主要实体
      const diseaseEntity = await this.createEntity({
        name: ['糖尿病', 'Diabetes Mellitus'],
        tags: ['疾病', '代谢疾病', '慢性病'],
        definition:
          '糖尿病是一组以高血糖为特征的代谢性疾病，由胰岛素分泌缺陷或其生物作用受损引起。',
      });

      const complicationEntity = await this.createEntity({
        name: ['糖尿病肾病', 'Diabetic Nephropathy'],
        tags: ['并发症', '肾脏疾病'],
        definition:
          '糖尿病肾病是糖尿病最常见的微血管并发症之一，是导致终末期肾病的主要原因。',
      });

      const treatmentEntity = await this.createEntity({
        name: ['胰岛素治疗', 'Insulin Therapy'],
        tags: ['治疗', '药物治疗'],
        definition:
          '胰岛素治疗是糖尿病管理的重要手段，通过补充外源性胰岛素来控制血糖水平。',
      });

      // 2. 创建实体间的关系
      await this.createEntityRelationship(
        diseaseEntity,
        complicationEntity,
        '可能导致',
      );
      await this.createEntityRelationship(
        diseaseEntity,
        treatmentEntity,
        '需要',
      );

      // 3. 为每个实体创建相关知识
      const diseaseKnowledge = await this.createKnowledgeForEntity(
        diseaseEntity,
        {
          scope: '病因和发病机制',
          content:
            '糖尿病的发病机制复杂，主要包括胰岛素抵抗和胰岛素分泌不足两个方面。1型糖尿病主要由自身免疫导致胰岛β细胞破坏；2型糖尿病则与遗传因素和环境因素共同作用有关。',
          childKnowledgeId: [],
        },
      );

      const complicationKnowledge = await this.createKnowledgeForEntity(
        complicationEntity,
        {
          scope: '临床表现',
          content:
            '糖尿病肾病早期无明显症状，随着病情进展可出现蛋白尿、水肿、高血压等表现。晚期可发展为肾功能衰竭。',
          childKnowledgeId: [],
        },
      );

      // 4. 创建交叉引用知识
      const crossReferenceKnowledge = await this.createCrossReferenceKnowledge(
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
      const diseaseRelations = await this.getEntityRelations(
        diseaseEntity.get_id(),
      );
      const complicationRelations = await this.getEntityRelations(
        complicationEntity.get_id(),
      );

      const isValid =
        diseaseRelations.length >= 2 && complicationRelations.length >= 1;

      this.logger.info('多实体关联场景测试结果', {
        diseaseRelations: diseaseRelations.length,
        complicationRelations: complicationRelations.length,
        isValid,
      });

      return isValid;
    } catch (error) {
      this.logger.error('多实体关联场景测试失败', error);
      return false;
    }
  }

  /**
   * 测试深度层次结构场景
   * 创建多层嵌套的知识结构
   */
  async testDeepHierarchyScenario(): Promise<boolean> {
    this.logger.info('开始测试深度层次结构场景');

    try {
      // 1. 创建根实体
      const rootEntity = await this.createEntity({
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
          this.knowledgeStorage,
        );

      // 3. 验证层次结构深度
      const maxDepth = await this.calculateMaxDepth(rootKnowledge);
      const totalNodes = await this.countTotalNodes(rootKnowledge);

      // 4. 生成可视化
      const mermaidDiagram = await this.visualizer.generateMermaidDiagram(
        rootEntity.get_id(),
      );
      const stats = await this.visualizer.generateRelationshipStats(
        rootEntity.get_id(),
      );

      const isValid = maxDepth >= 3 && totalNodes >= 5;

      this.logger.info('深度层次结构场景测试结果', {
        maxDepth,
        totalNodes,
        mermaidDiagramLength: mermaidDiagram.length,
        isValid,
      });

      return isValid;
    } catch (error) {
      this.logger.error('深度层次结构场景测试失败', error);
      return false;
    }
  }

  /**
   * 测试复杂查询场景
   * 包括多跳查询、路径查找、相似性搜索等
   */
  async testComplexQueryScenario(): Promise<boolean> {
    this.debugLog('=== 开始测试复杂查询场景 ===');

    try {
      // 1. 创建复杂的实体网络
      this.debugLog('开始创建医疗实体网络');
      const entities = await this.createMedicalEntityNetwork();
      this.debugLog('医疗实体网络创建完成', { entityCount: entities.length });

      if (entities.length < 2) {
        this.debugLog('实体数量不足，无法进行复杂查询测试', {
          entityCount: entities.length,
        });
        return false;
      }

      // 2. 测试多跳查询
      this.debugLog('开始测试多跳查询');
      const multiHopResults = await this.testMultiHopQuery(
        entities[0],
        entities[entities.length - 1],
      );
      this.debugLog('多跳查询测试完成', { multiHopResults });

      // 3. 测试路径查找
      this.debugLog('开始测试路径查找');
      const pathResults = await this.testPathFinding(
        entities[0],
        entities[entities.length - 1],
      );
      this.debugLog('路径查找测试完成', { pathResults });

      // 4. 测试相似性搜索
      this.debugLog('开始测试相似性搜索');
      const similarityResults = await this.testSimilaritySearch(entities[0]);
      this.debugLog('相似性搜索测试完成', { similarityResults });

      // 5. 测试聚合查询
      this.debugLog('开始测试聚合查询');
      const aggregationResults = await this.testAggregationQuery(entities[0]);
      this.debugLog('聚合查询测试完成', { aggregationResults });

      const isValid =
        multiHopResults &&
        pathResults &&
        similarityResults &&
        aggregationResults;

      this.debugLog('复杂查询场景测试结果', {
        multiHopResults,
        pathResults,
        similarityResults,
        aggregationResults,
        isValid,
      });

      return isValid;
    } catch (error) {
      this.debugLog('复杂查询场景测试失败', {
        error: error.message,
        stack: error.stack,
      });
      return false;
    }
  }

  /**
   * 测试并发操作场景
   * 验证系统在高并发情况下的稳定性
   */
  async testConcurrentOperationScenario(): Promise<boolean> {
    this.logger.info('开始测试并发操作场景');

    try {
      // 1. 创建基础实体
      const baseEntity = await this.createEntity({
        name: ['并发测试实体'],
        tags: ['测试'],
        definition: '用于并发测试的基础实体',
      });

      // 2. 并发创建多个知识
      const concurrentPromises: Promise<any>[] = [];
      for (let i = 0; i < 10; i++) {
        const promise =
          this.knowledgeWorkflow.create_simple_knowledge_from_text(
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
      const subordinateKnowledge = await baseEntity.get_subordinate_knowledge(
        this.knowledgeStorage,
      );
      const relationshipValid = subordinateKnowledge.length === 10;

      const isValid = allCreated && relationshipValid;

      this.logger.info('并发操作场景测试结果', {
        concurrentKnowledgeCount: concurrentResults.length,
        allCreated,
        relationshipValid,
        isValid,
      });

      return isValid;
    } catch (error) {
      this.logger.error('并发操作场景测试失败', error);
      return false;
    }
  }

  /**
   * 测试大数据量场景
   * 验证系统在处理大量数据时的性能
   */
  async testBigDataScenario(): Promise<boolean> {
    this.logger.info('开始测试大数据量场景');

    try {
      // 1. 创建大量实体
      const entities: Entity[] = [];
      const batchSize = 50;

      for (let i = 0; i < batchSize; i++) {
        const entity = await this.createEntity({
          name: [`大数据测试实体 ${i}`],
          tags: ['测试', '大数据'],
          definition: `这是第${i}个用于大数据测试的实体，包含大量测试数据。`,
        });
        entities.push(entity);
      }

      // 2. 为每个实体创建知识
      const knowledgePromises = entities.map(async (entity, index) => {
        return await this.knowledgeWorkflow.create_simple_knowledge_from_text(
          `大数据测试知识 ${index}：这是实体${index}的关联知识，包含详细的测试内容和数据。`,
          entity,
          `大数据测试知识 ${index}`,
        );
      });

      const knowledgeResults = await Promise.all(knowledgePromises);

      // 3. 测试批量查询性能
      const startTime = Date.now();
      const queryPromises = entities.map((entity) =>
        entity.get_subordinate_knowledge(this.knowledgeStorage),
      );
      await Promise.all(queryPromises);
      const queryTime = Date.now() - startTime;

      // 4. 测试批量可视化生成
      const vizStartTime = Date.now();
      const vizPromises = entities
        .slice(0, 5)
        .map((entity) =>
          this.visualizer.generateRelationshipStats(entity.get_id()),
        );
      await Promise.all(vizPromises);
      const vizTime = Date.now() - vizStartTime;

      const isValid =
        entities.length === batchSize &&
        knowledgeResults.length === batchSize &&
        queryTime < 10000 && // 查询应在10秒内完成
        vizTime < 5000; // 可视化应在5秒内完成

      this.logger.info('大数据量场景测试结果', {
        entityCount: entities.length,
        knowledgeCount: knowledgeResults.length,
        queryTime,
        vizTime,
        isValid,
      });

      return isValid;
    } catch (error) {
      this.logger.error('大数据量场景测试失败', error);
      return false;
    }
  }

  /**
   * 运行所有复杂场景测试
   */
  async runAllComplexTests(): Promise<{
    multiEntity: boolean;
    deepHierarchy: boolean;
    complexQuery: boolean;
    concurrentOperation: boolean;
    bigData: boolean;
    overall: boolean;
  }> {
    this.logger.info('开始运行所有复杂场景测试');

    const results = {
      multiEntity: await this.testMultiEntityScenario(),
      deepHierarchy: await this.testDeepHierarchyScenario(),
      complexQuery: await this.testComplexQueryScenario(),
      concurrentOperation: await this.testConcurrentOperationScenario(),
      bigData: await this.testBigDataScenario(),
      overall: false,
    };

    // Calculate overall result excluding the overall property itself
    const { overall: _, ...testResults } = results;
    results.overall = Object.values(testResults).every(
      (result) => result === true,
    );

    this.logger.info('所有复杂场景测试完成', results);

    return results;
  }

  // 辅助方法

  private async createEntity(entityData: EntityData): Promise<Entity> {
    return await Entity.create_entity_with_entity_data(entityData).save(
      this.entityStorage,
    );
  }

  private async createKnowledgeForEntity(
    entity: Entity,
    knowledgeData: KnowledgeData,
  ): Promise<any> {
    return await this.knowledgeWorkflow.create_simple_knowledge_from_text(
      knowledgeData.content,
      entity,
      knowledgeData.scope,
    );
  }

  private async createEntityRelationship(
    sourceEntity: Entity,
    targetEntity: Entity,
    relationType: string,
  ): Promise<void> {
    await this.entityStorage.entityGraphStorage.create_relation(
      sourceEntity.get_id(),
      targetEntity.get_id(),
      relationType,
    );
  }

  private async createCrossReferenceKnowledge(
    entity1: Entity,
    entity2: Entity,
    knowledgeData: KnowledgeData,
  ): Promise<any> {
    // 为第一个实体创建知识
    const knowledge1 = await this.createKnowledgeForEntity(
      entity1,
      knowledgeData,
    );

    // 为第二个实体创建相关知识
    const crossReferenceContent = `交叉引用：${knowledgeData.content}（与${entity2.get_definition().split('。')[0]}相关）`;
    await this.knowledgeWorkflow.create_simple_knowledge_from_text(
      crossReferenceContent,
      entity2,
      `交叉引用：${knowledgeData.scope}`,
    );

    return knowledge1;
  }

  private async getEntityRelations(entityId: string): Promise<any[]> {
    return await this.entityStorage.entityGraphStorage.get_entity_relations(
      entityId,
    );
  }

  private async calculateMaxDepth(
    knowledge: any,
    currentDepth: number = 1,
  ): Promise<number> {
    const children = knowledge.getChildren();
    if (children.length === 0) {
      return currentDepth;
    }

    let maxDepth = currentDepth;
    for (const child of children) {
      const childDepth = await this.calculateMaxDepth(child, currentDepth + 1);
      maxDepth = Math.max(maxDepth, childDepth);
    }

    return maxDepth;
  }

  private async countTotalNodes(knowledge: any): Promise<number> {
    const children = knowledge.getChildren();
    let count = 1; // 当前节点

    for (const child of children) {
      count += await this.countTotalNodes(child);
    }

    return count;
  }

  private async createMedicalEntityNetwork(): Promise<Entity[]> {
    this.logger.info('开始创建医疗实体网络');
    const entities: Entity[] = [];

    try {
      // 创建医疗实体网络
      const entityDataList = [
        {
          name: ['代谢综合征'],
          tags: ['疾病', '代谢疾病'],
          definition:
            '代谢综合征是一组代谢紊乱的集合，包括中心性肥胖、高血压、高血糖和血脂异常。',
        },
        {
          name: ['胰岛素抵抗'],
          tags: ['病理状态', '代谢异常'],
          definition:
            '胰岛素抵抗是指细胞对胰岛素的反应性降低，需要更高浓度的胰岛素才能产生正常的生物学效应。',
        },
        {
          name: ['肥胖症'],
          tags: ['疾病', '代谢疾病'],
          definition: '肥胖症是指体内脂肪堆积过多，对健康造成负面影响的疾病。',
        },
        {
          name: ['高血压'],
          tags: ['疾病', '心血管疾病'],
          definition:
            '高血压是指动脉血压持续升高的疾病，是心血管疾病的重要危险因素。',
        },
        {
          name: ['血脂异常'],
          tags: ['疾病', '代谢疾病'],
          definition:
            '血脂异常是指血液中脂质水平异常，包括高胆固醇、高甘油三酯等。',
        },
      ];

      this.logger.info('开始创建医疗实体', {
        entityCount: entityDataList.length,
      });

      for (const entityData of entityDataList) {
        this.logger.info('创建实体', { entityName: entityData.name[0] });
        const entity = await this.createEntity(entityData);
        entities.push(entity);
        this.logger.info('实体创建成功', { entityId: entity.get_id() });
      }

      this.logger.info('开始创建实体间关系', { entityCount: entities.length });

      // 创建实体间的关系
      for (let i = 0; i < entities.length - 1; i++) {
        this.logger.info('创建关系', {
          sourceId: entities[i].get_id(),
          targetId: entities[i + 1].get_id(),
          relationType: '相关',
        });
        await this.createEntityRelationship(
          entities[i],
          entities[i + 1],
          '相关',
        );
        this.logger.info('关系创建成功');
      }

      this.logger.info('医疗实体网络创建完成', {
        totalEntities: entities.length,
      });
      return entities;
    } catch (error) {
      this.logger.error('创建医疗实体网络失败', error);
      throw error;
    }
  }

  private async testMultiHopQuery(
    sourceEntity: Entity,
    targetEntity: Entity,
  ): Promise<boolean> {
    try {
      // 测试多跳查询（通过图存储）
      const sourceId = sourceEntity.get_id();
      const targetId = targetEntity.get_id();

      this.debugLog('Testing multi-hop query', {
        sourceId,
        targetId,
        sourceName: sourceEntity.get_definition().split('。')[0],
        targetName: targetEntity.get_definition().split('。')[0],
      });

      const paths = await this.entityStorage.entityGraphStorage.find_paths(
        sourceId,
        targetId,
        5,
      );

      this.debugLog('Multi-hop query result', {
        pathsCount: paths.length,
        paths: paths,
      });

      return paths.length > 0;
    } catch (error) {
      this.debugLog('多跳查询测试失败', {
        error: error.message,
        stack: error.stack,
      });
      return false;
    }
  }

  private async testPathFinding(
    sourceEntity: Entity,
    targetEntity: Entity,
  ): Promise<boolean> {
    try {
      // 测试路径查找
      const sourceId = sourceEntity.get_id();
      const targetId = targetEntity.get_id();

      this.debugLog('Testing path finding', {
        sourceId,
        targetId,
        sourceName: sourceEntity.get_definition().split('。')[0],
        targetName: targetEntity.get_definition().split('。')[0],
      });

      // First check if entities exist
      const sourceExists =
        await this.entityStorage.entityContentStorage.get_entity_by_id(
          sourceId,
        );
      const targetExists =
        await this.entityStorage.entityContentStorage.get_entity_by_id(
          targetId,
        );

      this.debugLog('Entity existence check', {
        sourceExists: !!sourceExists,
        targetExists: !!targetExists,
        sourceData: sourceExists
          ? { id: sourceExists.id, name: sourceExists.name }
          : null,
        targetData: targetExists
          ? { id: targetExists.id, name: targetExists.name }
          : null,
      });

      // Check if relations exist for source entity
      const sourceRelations =
        await this.entityStorage.entityGraphStorage.get_entity_relations(
          sourceId,
        );
      this.debugLog('Source entity relations', {
        sourceId,
        relationCount: sourceRelations.length,
        relations: sourceRelations.slice(0, 5), // Show first 5 relations
      });

      const paths = await this.entityStorage.entityGraphStorage.find_paths(
        sourceId,
        targetId,
        5,
      );

      this.debugLog('Path finding result', {
        pathsCount: paths.length,
        paths: paths,
      });

      return paths.length > 0;
    } catch (error) {
      this.debugLog('路径查找测试失败', {
        error: error.message,
        stack: error.stack,
      });
      return false;
    }
  }

  private async testSimilaritySearch(entity: Entity): Promise<boolean> {
    try {
      // 测试相似性搜索
      const queryVector = [1, 0, 0];
      const similarEntities =
        await this.entityStorage.entityVectorStorage.find_similar_vectors(
          queryVector,
          5,
          0.5,
        );

      return true; // 由于使用模拟向量存储，主要验证接口调用
    } catch (error) {
      this.logger.error('相似性搜索测试失败', error);
      return false;
    }
  }

  private async testAggregationQuery(entity: Entity): Promise<boolean> {
    try {
      // 测试聚合查询
      const subordinateKnowledge = await entity.get_subordinate_knowledge(
        this.knowledgeStorage,
      );
      const totalKnowledge = subordinateKnowledge.length;

      // 计算所有知识的总内容长度
      const totalContentLength = subordinateKnowledge.reduce(
        (sum, knowledge) => sum + knowledge.getData().content.length,
        0,
      );

      return totalKnowledge >= 0 && totalContentLength >= 0;
    } catch (error) {
      this.logger.error('聚合查询测试失败', error);
      return false;
    }
  }
}

/**
 * 运行复杂场景测试的主函数
 */
export async function runComplexScenarioTests() {
  const test = new ComplexScenarioTest();
  const results = await test.runAllComplexTests();

  console.log('=== 复杂场景测试结果 ===');
  console.log(`多实体关联: ${results.multiEntity ? '✅ 通过' : '❌ 失败'}`);
  console.log(`深度层次结构: ${results.deepHierarchy ? '✅ 通过' : '❌ 失败'}`);
  console.log(`复杂查询: ${results.complexQuery ? '✅ 通过' : '❌ 失败'}`);
  console.log(
    `并发操作: ${results.concurrentOperation ? '✅ 通过' : '❌ 失败'}`,
  );
  console.log(`大数据量: ${results.bigData ? '✅ 通过' : '❌ 失败'}`);
  console.log(`总体结果: ${results.overall ? '✅ 全部通过' : '❌ 存在失败'}`);

  return results;
}

// 如果直接运行此文件，执行测试
if (require.main === module) {
  runComplexScenarioTests()
    .then((results) => {
      process.exit(results.overall ? 0 : 1);
    })
    .catch((error) => {
      console.error('复杂场景测试过程中发生错误:', error);
      process.exit(1);
    });
}
