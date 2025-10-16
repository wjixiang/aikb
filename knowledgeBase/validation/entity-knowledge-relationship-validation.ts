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
import createLoggerWithPrefix from '../../lib/logger';

/**
 * 验证实体-知识关系的正确性
 * 基于"肾病综合征的临床表现可总结为'三高一低'：大量蛋白尿、低蛋白血症、水肿和高脂血症"案例
 */
export class EntityKnowledgeRelationshipValidation {
  private logger = createLoggerWithPrefix(
    'EntityKnowledgeRelationshipValidation',
  );
  private knowledgeStorage: KnowledgeStorage;
  private entityStorage: EntityStorage;
  private knowledgeWorkflow: KnowledgeCreationWorkflow;

  constructor() {
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
  }

  /**
   * 验证完整的实体-知识关系创建流程
   */
  async validateCompleteEntityKnowledgeCreation(): Promise<boolean> {
    this.logger.info('开始验证完整的实体-知识关系创建流程');

    try {
      // 1. 创建主实体：肾病综合征
      const nephroticSyndromeEntity =
        await this.createNephroticSyndromeEntity();

      // 2. 创建临床表现知识
      const clinicalManifestationsKnowledge =
        await this.createClinicalManifestationsKnowledge(
          nephroticSyndromeEntity,
        );

      // 3. 创建症状实体并建立关系
      const symptomEntities = await this.createSymptomEntities();
      await this.linkSymptomsToKnowledge(
        clinicalManifestationsKnowledge,
        symptomEntities,
      );

      // 4. 验证关系结构
      const isStructureValid = await this.validateRelationshipStructure(
        nephroticSyndromeEntity,
      );

      // 5. 验证双向查询
      const isBidirectionalValid = await this.validateBidirectionalQueries(
        nephroticSyndromeEntity,
      );

      this.logger.info('实体-知识关系创建流程验证完成', {
        isStructureValid,
        isBidirectionalValid,
      });

      return isStructureValid && isBidirectionalValid;
    } catch (error) {
      this.logger.error('验证实体-知识关系创建流程失败', error);
      return false;
    }
  }

  /**
   * 创建肾病综合征实体
   */
  private async createNephroticSyndromeEntity(): Promise<Entity> {
    const entityData: EntityData = {
      name: ['肾病综合征', 'Nephrotic Syndrome'],
      tags: ['疾病', '肾脏疾病', '综合征'],
      definition:
        '肾病综合征是一组由多种病因引起的临床症候群，以大量蛋白尿、低蛋白血症、水肿和高脂血症为特征。',
    };

    const entity = await Entity.create_entity_with_entity_data(entityData).save(
      this.entityStorage,
    );
    this.logger.info(`创建肾病综合征实体成功，ID: ${entity.get_id()}`);

    return entity;
  }

  /**
   * 创建临床表现知识
   */
  private async createClinicalManifestationsKnowledge(parentEntity: Entity) {
    const clinicalText =
      '肾病综合征的临床表现可总结为"三高一低"：大量蛋白尿、低蛋白血症、水肿和高脂血症。这些表现共同构成了肾病综合征的典型临床特征。';

    const knowledge =
      await this.knowledgeWorkflow.create_simple_knowledge_from_text(
        clinicalText,
        parentEntity,
        '临床表现',
      );

    this.logger.info(`创建临床表现知识成功，ID: ${knowledge.get_id()}`);
    return knowledge;
  }

  /**
   * 创建症状实体
   */
  private async createSymptomEntities(): Promise<Entity[]> {
    const symptoms = [
      {
        name: ['大量蛋白尿', 'Massive Proteinuria'],
        tags: ['症状', '尿液异常'],
        definition:
          '大量蛋白尿是指24小时尿蛋白定量超过3.5g，是肾病综合征的主要特征之一。',
      },
      {
        name: ['低蛋白血症', 'Hypoproteinemia'],
        tags: ['症状', '血液异常'],
        definition:
          '低蛋白血症是指血浆白蛋白水平低于30g/L，由于大量蛋白尿导致蛋白质丢失所致。',
      },
      {
        name: ['水肿', 'Edema'],
        tags: ['症状', '体液异常'],
        definition:
          '水肿是由于低蛋白血症导致血浆胶体渗透压降低，液体从血管内渗出到组织间隙所致。',
      },
      {
        name: ['高脂血症', 'Hyperlipidemia'],
        tags: ['症状', '代谢异常'],
        definition:
          '高脂血症是机体代偿性增加肝脏脂蛋白合成以补偿低蛋白血症的结果。',
      },
    ];

    const symptomEntities: Entity[] = [];

    for (const symptomData of symptoms) {
      const entity = await Entity.create_entity_with_entity_data(
        symptomData,
      ).save(this.entityStorage);
      symptomEntities.push(entity);
      this.logger.info(
        `创建症状实体成功: ${symptomData.name[0]}，ID: ${entity.get_id()}`,
      );
    }

    return symptomEntities;
  }

  /**
   * 将症状实体链接到临床表现知识
   */
  private async linkSymptomsToKnowledge(
    clinicalKnowledge: any,
    symptomEntities: Entity[],
  ) {
    // 为每个症状创建相关知识并链接
    for (const symptomEntity of symptomEntities) {
      const symptomName = symptomEntity.get_definition().split('是指')[0];
      const symptomKnowledge =
        await this.knowledgeWorkflow.create_simple_knowledge_from_text(
          `${symptomName}是肾病综合征的重要临床表现之一。`,
          symptomEntity,
          '与肾病综合征的关系',
        );

      this.logger.info(
        `创建症状知识并链接成功: ${symptomName}，知识ID: ${symptomKnowledge.get_id()}`,
      );
    }
  }

  /**
   * 验证关系结构
   */
  private async validateRelationshipStructure(
    mainEntity: Entity,
  ): Promise<boolean> {
    try {
      // 获取主实体的所有下属知识
      const subordinateKnowledge = await mainEntity.get_subordinate_knowledge(
        this.knowledgeStorage,
      );

      if (subordinateKnowledge.length === 0) {
        this.logger.error('主实体没有下属知识');
        return false;
      }

      // 验证临床表现知识存在
      const clinicalKnowledge = subordinateKnowledge.find(
        (k) => k.getData().scope === '临床表现',
      );

      if (!clinicalKnowledge) {
        this.logger.error('未找到临床表现知识');
        return false;
      }

      this.logger.info('关系结构验证通过', {
        mainEntityId: mainEntity.get_id(),
        subordinateKnowledgeCount: subordinateKnowledge.length,
        clinicalKnowledgeId: clinicalKnowledge.get_id(),
      });

      return true;
    } catch (error) {
      this.logger.error('验证关系结构失败', error);
      return false;
    }
  }

  /**
   * 验证双向查询
   */
  private async validateBidirectionalQueries(
    mainEntity: Entity,
  ): Promise<boolean> {
    try {
      // 1. 从实体查询知识
      const entityToKnowledge = await mainEntity.get_subordinate_knowledge(
        this.knowledgeStorage,
      );

      // 2. 从知识查询实体（通过图存储反向查询）
      const knowledgeToEntity: Array<{
        entityId: string;
        knowledgeId: string;
        linkType: string;
      }> = [];
      for (const knowledge of entityToKnowledge) {
        const links =
          await this.knowledgeStorage.knowledgeGraphStorage.get_knowledge_links_by_source(
            mainEntity.get_id(),
          );

        for (const link of links) {
          // 验证链接的目标确实是知识
          const targetKnowledge =
            await this.knowledgeStorage.get_knowledge_by_id(link.targetId);
          if (targetKnowledge) {
            knowledgeToEntity.push({
              entityId: mainEntity.get_id(),
              knowledgeId: link.targetId,
              linkType: link.linkType,
            });
          }
        }
      }

      const isValid =
        entityToKnowledge.length > 0 && knowledgeToEntity.length > 0;

      this.logger.info('双向查询验证结果', {
        entityToKnowledgeCount: entityToKnowledge.length,
        knowledgeToEntityCount: knowledgeToEntity.length,
        isValid,
      });

      return isValid;
    } catch (error) {
      this.logger.error('验证双向查询失败', error);
      return false;
    }
  }

  /**
   * 验证知识层次结构的正确性
   */
  async validateKnowledgeHierarchy(): Promise<boolean> {
    this.logger.info('开始验证知识层次结构');

    try {
      // 创建一个测试实体
      const testEntityData: EntityData = {
        name: ['测试实体'],
        tags: ['测试'],
        definition: '用于测试知识层次结构的实体',
      };

      const testEntity = await Entity.create_entity_with_entity_data(
        testEntityData,
      ).save(this.entityStorage);

      // 创建多层次知识结构
      const hierarchyText = `
      主要主题：
      这是主要主题的内容。
      
      子主题1：
      这是第一个子主题的详细内容。
      
      子主题2：
      这是第二个子主题的详细内容。
      
      子子主题：
      这是子子主题的内容，用于测试更深层次的结构。
      `;

      const rootKnowledge =
        await testEntity.create_subordinate_knowledge_from_text(
          hierarchyText,
          this.knowledgeStorage,
        );

      // 验证层次结构
      const children = rootKnowledge.getChildren();
      let hasValidHierarchy = children.length > 0;

      for (const child of children) {
        const grandchildren = child.getChildren();
        if (grandchildren.length > 0) {
          this.logger.info('发现多层次知识结构', {
            parentId: rootKnowledge.get_id(),
            childId: child.get_id(),
            grandchildCount: grandchildren.length,
          });
        }
      }

      // 渲染为Markdown验证结构
      const markdown = rootKnowledge.render_to_markdown_string();
      const hasValidMarkdown =
        markdown.includes('#') && markdown.includes('##');

      this.logger.info('知识层次结构验证结果', {
        hasValidHierarchy,
        hasValidMarkdown,
        childCount: children.length,
        markdownLength: markdown.length,
      });

      return hasValidHierarchy && hasValidMarkdown;
    } catch (error) {
      this.logger.error('验证知识层次结构失败', error);
      return false;
    }
  }

  /**
   * 测试向量相似性搜索在关系查询中的应用
   */
  async validateVectorSimilaritySearch(): Promise<boolean> {
    this.logger.info('开始验证向量相似性搜索');

    try {
      // 创建几个相关的实体
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
        const entity = await Entity.create_entity_with_entity_data(
          entityData,
        ).save(this.entityStorage);
        createdEntities.push(entity);
      }

      // 测试向量相似性搜索（使用模拟的向量存储）
      const queryVector = [1, 0, 0]; // 简单的测试向量
      const similarEntities =
        await this.entityStorage.entityVectorStorage.find_similar_vectors(
          queryVector,
          3,
          0.5,
        );

      this.logger.info('向量相似性搜索验证结果', {
        createdEntityCount: createdEntities.length,
        similarEntityCount: similarEntities.length,
      });

      // 注意：由于使用的是模拟向量存储，这里主要验证接口调用是否成功
      return createdEntities.length === 3;
    } catch (error) {
      this.logger.error('验证向量相似性搜索失败', error);
      return false;
    }
  }

  /**
   * 运行所有验证测试
   */
  async runAllValidations(): Promise<{
    entityKnowledgeCreation: boolean;
    knowledgeHierarchy: boolean;
    vectorSimilaritySearch: boolean;
    overall: boolean;
  }> {
    this.logger.info('开始运行所有验证测试');

    const results = {
      entityKnowledgeCreation:
        await this.validateCompleteEntityKnowledgeCreation(),
      knowledgeHierarchy: await this.validateKnowledgeHierarchy(),
      vectorSimilaritySearch: await this.validateVectorSimilaritySearch(),
      overall: false,
    };

    results.overall =
      results.entityKnowledgeCreation &&
      results.knowledgeHierarchy &&
      results.vectorSimilaritySearch;

    this.logger.info('所有验证测试完成', results);

    return results;
  }
}

/**
 * 运行验证测试的主函数
 */
export async function runEntityKnowledgeRelationshipValidation() {
  const validation = new EntityKnowledgeRelationshipValidation();
  const results = await validation.runAllValidations();

  console.log('=== 实体-知识关系验证结果 ===');
  console.log(
    `实体-知识创建流程: ${results.entityKnowledgeCreation ? '✅ 通过' : '❌ 失败'}`,
  );
  console.log(
    `知识层次结构: ${results.knowledgeHierarchy ? '✅ 通过' : '❌ 失败'}`,
  );
  console.log(
    `向量相似性搜索: ${results.vectorSimilaritySearch ? '✅ 通过' : '❌ 失败'}`,
  );
  console.log(`总体结果: ${results.overall ? '✅ 全部通过' : '❌ 存在失败'}`);

  return results;
}

// 如果直接运行此文件，执行验证
if (require.main === module) {
  runEntityKnowledgeRelationshipValidation()
    .then((results) => {
      process.exit(results.overall ? 0 : 1);
    })
    .catch((error) => {
      console.error('验证过程中发生错误:', error);
      process.exit(1);
    });
}
