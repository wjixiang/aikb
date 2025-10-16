import Entity from '../Entity';
import Knowledge from '../Knowledge';
import { AbstractKnowledgeStorage } from '../storage/abstract-storage';
import { AbstractEntityStorage } from '../storage/abstract-storage';
import createLoggerWithPrefix from '../../lib/logger';

/**
 * 实体-知识关系可视化工具
 * 用于展示和分析实体-知识图结构
 */
export class RelationshipVisualizer {
  private logger = createLoggerWithPrefix('RelationshipVisualizer');

  constructor(
    private knowledgeStorage: AbstractKnowledgeStorage,
    private entityStorage: AbstractEntityStorage,
  ) {}

  /**
   * 生成实体-知识关系的DOT格式图描述
   * 可用于Graphviz等工具渲染
   */
  async generateDotGraph(entityId: string): Promise<string> {
    this.logger.info(`生成实体 ${entityId} 的DOT图`);

    try {
      const entity =
        await this.entityStorage.entityContentStorage.get_entity_by_id(
          entityId,
        );
      if (!entity) {
        throw new Error(`实体 ${entityId} 不存在`);
      }

      const dotLines: string[] = [];
      dotLines.push('digraph EntityKnowledgeGraph {');
      dotLines.push('  rankdir=TB;');
      dotLines.push('  node [shape=box, style=filled];');
      dotLines.push('  edge [color=blue];');
      dotLines.push('');

      // 添加实体节点
      const entityLabel = this.escapeLabel(`${entity.name[0]}\\n(实体)`);
      dotLines.push(
        `  "${entityId}" [label="${entityLabel}", fillcolor=lightblue];`,
      );

      // 获取实体的所有下属知识
      const subordinateKnowledge = await this.getSubordinateKnowledge(entityId);

      // 添加知识节点和关系
      for (const knowledge of subordinateKnowledge) {
        const knowledgeId = knowledge.get_id();
        const knowledgeLabel = this.escapeLabel(
          `${knowledge.getData().scope}\\n(知识)`,
        );
        dotLines.push(
          `  "${knowledgeId}" [label="${knowledgeLabel}", fillcolor=lightgreen];`,
        );
        dotLines.push(`  "${entityId}" -> "${knowledgeId}" [label="拥有"];`);

        // 递归添加子知识
        await this.addKnowledgeToDot(dotLines, knowledge, 2);
      }

      dotLines.push('}');

      const dotGraph = dotLines.join('\n');
      this.logger.info(`DOT图生成成功，大小: ${dotGraph.length} 字符`);

      return dotGraph;
    } catch (error) {
      this.logger.error('生成DOT图失败', error);
      throw error;
    }
  }

  /**
   * 递归添加知识节点到DOT图
   */
  private async addKnowledgeToDot(
    dotLines: string[],
    knowledge: Knowledge,
    level: number,
  ): Promise<void> {
    const children = knowledge.getChildren();

    for (const child of children) {
      const childId = child.get_id();
      const childLabel = this.escapeLabel(`${child.getData().scope}\\n(知识)`);
      const color = level % 2 === 0 ? 'lightgreen' : 'lightyellow';

      dotLines.push(
        `  "${childId}" [label="${childLabel}", fillcolor=${color}];`,
      );
      dotLines.push(
        `  "${knowledge.get_id()}" -> "${childId}" [label="包含"];`,
      );

      // 递归处理子知识
      if (child.getChildren().length > 0) {
        await this.addKnowledgeToDot(dotLines, child, level + 1);
      }
    }
  }

  /**
   * 生成HTML格式的可视化图
   */
  async generateHtmlVisualization(entityId: string): Promise<string> {
    this.logger.info(`生成实体 ${entityId} 的HTML可视化`);

    try {
      const entity =
        await this.entityStorage.entityContentStorage.get_entity_by_id(
          entityId,
        );
      if (!entity) {
        throw new Error(`实体 ${entityId} 不存在`);
      }

      const subordinateKnowledge = await this.getSubordinateKnowledge(entityId);

      const htmlLines: string[] = [];
      htmlLines.push('<!DOCTYPE html>');
      htmlLines.push('<html lang="zh-CN">');
      htmlLines.push('<head>');
      htmlLines.push('  <meta charset="UTF-8">');
      htmlLines.push(
        '  <meta name="viewport" content="width=device-width, initial-scale=1.0">',
      );
      htmlLines.push('  <title>实体-知识关系可视化</title>');
      htmlLines.push('  <style>');
      htmlLines.push(
        '    body { font-family: Arial, sans-serif; margin: 20px; }',
      );
      htmlLines.push(
        '    .entity { background-color: #e3f2fd; padding: 15px; margin: 10px 0; border-radius: 8px; border-left: 5px solid #2196f3; }',
      );
      htmlLines.push(
        '    .knowledge { background-color: #e8f5e8; padding: 10px; margin: 5px 0 5px 20px; border-radius: 5px; border-left: 3px solid #4caf50; }',
      );
      htmlLines.push(
        '    .child-knowledge { background-color: #fff9c4; padding: 8px; margin: 3px 0 3px 40px; border-radius: 3px; border-left: 2px solid #ffc107; }',
      );
      htmlLines.push(
        '    .relationship { color: #666; font-style: italic; margin: 2px 0; }',
      );
      htmlLines.push(
        '    .stats { background-color: #f5f5f5; padding: 10px; margin: 20px 0; border-radius: 5px; }',
      );
      htmlLines.push('  </style>');
      htmlLines.push('</head>');
      htmlLines.push('<body>');
      htmlLines.push(`  <h1>实体-知识关系可视化: ${entity.name[0]}</h1>`);

      // 添加统计信息
      htmlLines.push('  <div class="stats">');
      htmlLines.push(`    <h3>统计信息</h3>`);
      htmlLines.push(`    <p>实体ID: ${entityId}</p>`);
      htmlLines.push(`    <p>实体名称: ${entity.name.join(', ')}</p>`);
      htmlLines.push(`    <p>下属知识数量: ${subordinateKnowledge.length}</p>`);
      htmlLines.push(`    <p>实体标签: ${entity.tags.join(', ')}</p>`);
      htmlLines.push('  </div>');

      // 添加实体信息
      htmlLines.push('  <div class="entity">');
      htmlLines.push(`    <h2>${entity.name[0]} (实体)</h2>`);
      htmlLines.push(`    <p><strong>定义:</strong> ${entity.definition}</p>`);
      htmlLines.push('  </div>');

      // 添加知识层次结构
      htmlLines.push('  <h2>知识层次结构</h2>');

      for (const knowledge of subordinateKnowledge) {
        await this.addKnowledgeToHtml(htmlLines, knowledge, 1);
      }

      htmlLines.push('</body>');
      htmlLines.push('</html>');

      const html = htmlLines.join('\n');
      this.logger.info(`HTML可视化生成成功，大小: ${html.length} 字符`);

      return html;
    } catch (error) {
      this.logger.error('生成HTML可视化失败', error);
      throw error;
    }
  }

  /**
   * 递归添加知识节点到HTML
   */
  private async addKnowledgeToHtml(
    htmlLines: string[],
    knowledge: Knowledge,
    level: number,
  ): Promise<void> {
    const data = knowledge.getData();
    const className = level === 1 ? 'knowledge' : 'child-knowledge';

    htmlLines.push(`  <div class="${className}">`);
    htmlLines.push(`    <h${level + 2}>${data.scope} (知识)</h${level + 2}>`);
    htmlLines.push(`    <p><strong>内容:</strong> ${data.content}</p>`);
    htmlLines.push(
      `    <p class="relationship">知识ID: ${knowledge.get_id()}</p>`,
    );

    if (data.childKnowledgeId.length > 0) {
      htmlLines.push(
        `    <p class="relationship">包含 ${data.childKnowledgeId.length} 个子知识</p>`,
      );
    }

    htmlLines.push('  </div>');

    // 递归处理子知识
    const children = knowledge.getChildren();
    for (const child of children) {
      await this.addKnowledgeToHtml(htmlLines, child, level + 1);
    }
  }

  /**
   * 生成JSON格式的关系统计数据
   */
  async generateRelationshipStats(entityId: string): Promise<any> {
    this.logger.info(`生成实体 ${entityId} 的关系统计`);

    try {
      const entity =
        await this.entityStorage.entityContentStorage.get_entity_by_id(
          entityId,
        );
      if (!entity) {
        throw new Error(`实体 ${entityId} 不存在`);
      }

      const subordinateKnowledge = await this.getSubordinateKnowledge(entityId);

      const stats = {
        entity: {
          id: entityId,
          name: entity.name,
          tags: entity.tags,
          definition: entity.definition,
        },
        knowledge: {
          totalCount: subordinateKnowledge.length,
          items: [] as any[],
        },
        hierarchy: {
          maxDepth: 0,
          totalNodes: 0,
        },
        relationships: {
          entityToKnowledge: subordinateKnowledge.length,
          knowledgeToKnowledge: 0,
        },
      };

      // 分析知识层次结构
      for (const knowledge of subordinateKnowledge) {
        const knowledgeStats = await this.analyzeKnowledgeHierarchy(
          knowledge,
          1,
        );
        stats.knowledge.items.push(knowledgeStats);
        stats.hierarchy.maxDepth = Math.max(
          stats.hierarchy.maxDepth,
          knowledgeStats.maxDepth,
        );
        stats.hierarchy.totalNodes += knowledgeStats.totalNodes;
        stats.relationships.knowledgeToKnowledge += knowledgeStats.childCount;
      }

      this.logger.info('关系统计生成成功', stats);
      return stats;
    } catch (error) {
      this.logger.error('生成关系统计失败', error);
      throw error;
    }
  }

  /**
   * 分析知识层次结构
   */
  private async analyzeKnowledgeHierarchy(
    knowledge: Knowledge,
    currentDepth: number,
  ): Promise<any> {
    const data = knowledge.getData();
    const children = knowledge.getChildren();

    let maxDepth = currentDepth;
    let totalNodes = 1;
    const childStats: any[] = [];

    for (const child of children) {
      const childStat = await this.analyzeKnowledgeHierarchy(
        child,
        currentDepth + 1,
      );
      childStats.push(childStat);
      maxDepth = Math.max(maxDepth, childStat.maxDepth);
      totalNodes += childStat.totalNodes;
    }

    return {
      id: knowledge.get_id(),
      scope: data.scope,
      content:
        data.content.substring(0, 100) +
        (data.content.length > 100 ? '...' : ''),
      depth: currentDepth,
      maxDepth,
      totalNodes,
      childCount: children.length,
      children: childStats,
    };
  }

  /**
   * 获取实体的所有下属知识（递归）
   */
  private async getSubordinateKnowledge(
    entityId: string,
  ): Promise<Knowledge[]> {
    const links =
      await this.knowledgeStorage.knowledgeGraphStorage.get_knowledge_links_by_source(
        entityId,
      );
    const knowledgeItems: Knowledge[] = [];

    for (const link of links) {
      const knowledge = await this.knowledgeStorage.get_knowledge_by_id(
        link.targetId,
      );
      if (knowledge) {
        knowledgeItems.push(knowledge);
      }
    }

    return knowledgeItems;
  }

  /**
   * 转义DOT标签中的特殊字符
   */
  private escapeLabel(label: string): string {
    return label.replace(/"/g, '\\"').replace(/\n/g, '\\n');
  }

  /**
   * 生成Mermaid格式的流程图
   */
  async generateMermaidDiagram(entityId: string): Promise<string> {
    this.logger.info(`生成实体 ${entityId} 的Mermaid图表`);

    try {
      const entity =
        await this.entityStorage.entityContentStorage.get_entity_by_id(
          entityId,
        );
      if (!entity) {
        throw new Error(`实体 ${entityId} 不存在`);
      }

      const subordinateKnowledge = await this.getSubordinateKnowledge(entityId);

      const mermaidLines: string[] = [];
      mermaidLines.push('graph TD');
      mermaidLines.push(`    E["${entity.name[0]}<br/>实体"]`);

      // 添加知识节点
      for (let i = 0; i < subordinateKnowledge.length; i++) {
        const knowledge = subordinateKnowledge[i];
        const knowledgeId = `K${i}`;
        mermaidLines.push(
          `    ${knowledgeId}["${knowledge.getData().scope}<br/>知识"]`,
        );
        mermaidLines.push(`    E --> ${knowledgeId}`);

        // 添加子知识
        await this.addKnowledgeToMermaid(
          mermaidLines,
          knowledge,
          knowledgeId,
          1,
        );
      }

      // 添加样式
      mermaidLines.push(
        '    classDef entity fill:#e3f2fd,stroke:#2196f3,stroke-width:2px',
      );
      mermaidLines.push(
        '    classDef knowledge fill:#e8f5e8,stroke:#4caf50,stroke-width:2px',
      );
      mermaidLines.push(
        '    classDef childKnowledge fill:#fff9c4,stroke:#ffc107,stroke-width:2px',
      );
      mermaidLines.push('    class E entity');

      const mermaidDiagram = mermaidLines.join('\n');
      this.logger.info(
        `Mermaid图表生成成功，大小: ${mermaidDiagram.length} 字符`,
      );

      return mermaidDiagram;
    } catch (error) {
      this.logger.error('生成Mermaid图表失败', error);
      throw error;
    }
  }

  /**
   * 递归添加知识节点到Mermaid图表
   */
  private async addKnowledgeToMermaid(
    mermaidLines: string[],
    knowledge: Knowledge,
    parentId: string,
    level: number,
  ): Promise<void> {
    const children = knowledge.getChildren();

    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      const childId = `${parentId}C${i}`;
      const className = level === 1 ? 'knowledge' : 'childKnowledge';

      mermaidLines.push(`    ${childId}["${child.getData().scope}<br/>知识"]`);
      mermaidLines.push(`    ${parentId} --> ${childId}`);
      mermaidLines.push(`    class ${childId} ${className}`);

      // 递归处理子知识
      if (child.getChildren().length > 0) {
        await this.addKnowledgeToMermaid(
          mermaidLines,
          child,
          childId,
          level + 1,
        );
      }
    }
  }

  /**
   * 保存可视化文件到指定路径
   */
  async saveVisualizationFile(
    entityId: string,
    outputPath: string,
    format: 'html' | 'dot' | 'mermaid' | 'json' = 'html',
  ): Promise<void> {
    this.logger.info(`保存可视化文件: ${outputPath}, 格式: ${format}`);

    try {
      let content: string;

      switch (format) {
        case 'html':
          content = await this.generateHtmlVisualization(entityId);
          break;
        case 'dot':
          content = await this.generateDotGraph(entityId);
          break;
        case 'mermaid':
          content = await this.generateMermaidDiagram(entityId);
          break;
        case 'json':
          content = JSON.stringify(
            await this.generateRelationshipStats(entityId),
            null,
            2,
          );
          break;
        default:
          throw new Error(`不支持的格式: ${format}`);
      }

      // 这里应该使用文件系统API保存文件
      // 由于在浏览器环境中，我们只返回内容
      this.logger.info(`可视化文件内容准备完成，大小: ${content.length} 字符`);

      // 在实际应用中，这里应该调用文件系统API
      // await fs.writeFile(outputPath, content, 'utf8');

      console.log(`可视化内容已准备，可保存到: ${outputPath}`);
      console.log(`内容预览 (前200字符): ${content.substring(0, 200)}...`);
    } catch (error) {
      this.logger.error('保存可视化文件失败', error);
      throw error;
    }
  }
}

/**
 * 创建关系可视化器的便捷函数
 */
export function createRelationshipVisualizer(
  knowledgeStorage: AbstractKnowledgeStorage,
  entityStorage: AbstractEntityStorage,
): RelationshipVisualizer {
  return new RelationshipVisualizer(knowledgeStorage, entityStorage);
}
