import { b } from '../../baml_client';
import { ScopeExtractResult } from '../../baml_client/types';
import { KnowledgeData } from '../knowledge.type';
import { AbstractKnowledgeStorage } from '../storage/abstract-storage';
import Knowledge from '../Knowledge';
import Entity from '../Entity';
import { EntityExtractor } from './EntityExtractor';
import createLoggerWithPrefix from '../lib/logger';

/**
 * Workflow class for creating knowledge hierarchy from natural language text
 */
export class KnowledgeCreationWorkflow {
  private logger = createLoggerWithPrefix('KnowledgeCreationWorkflow');
  private entityExtractor: EntityExtractor;

  constructor(private knowledgeStorage: AbstractKnowledgeStorage) {
    this.entityExtractor = new EntityExtractor();
  }

  /**
   * Create a knowledge hierarchy from natural language text
   * @param text The natural language text to process
   * @param parentEntity The parent entity for the knowledge
   * @returns Promise resolving to the root Knowledge instance
   */
  async create_knowledge_hierarchy_from_text(
    text: string,
    parentEntity: Entity,
  ): Promise<Knowledge> {
    this.logger.info('Creating knowledge hierarchy from text', {
      entityId: parentEntity.get_id(),
      textLength: text.length,
    });

    try {
      // Extract main entity from text
      const mainEntity = await this.entityExtractor.extractMainEntity(text);
      this.logger.info('Extracted main entity', { mainEntity });

      // Extract knowledge scopes from text
      const scopes = await this.extractKnowledgeScopes(mainEntity.name, text);
      this.logger.info('Extracted knowledge scopes', {
        scopeCount: scopes.length,
      });

      // Create root knowledge
      const rootKnowledgeData: KnowledgeData = {
        scope: mainEntity.name,
        content: mainEntity.abstract,
        childKnowledgeId: [],
      };

      const tempRootKnowledge =
        parentEntity.create_knowledge_with_knowledge_data(rootKnowledgeData);
      const rootKnowledge = await tempRootKnowledge.save(this.knowledgeStorage);
      this.logger.info('Created root knowledge', {
        knowledgeId: rootKnowledge.get_id(),
      });

      // Create a hierarchical structure by analyzing the text for nested patterns
      await this.createHierarchicalKnowledge(rootKnowledge, text, scopes);

      this.logger.info('Knowledge hierarchy created successfully');
      return rootKnowledge;
    } catch (error) {
      this.logger.error('Error creating knowledge hierarchy', error);
      throw error;
    }
  }

  /**
   * Create a hierarchical knowledge structure from text and scopes
   * @param parentKnowledge The parent knowledge node
   * @param text The original text
   * @param scopes Extracted scopes
   */
  private async createHierarchicalKnowledge(
    parentKnowledge: Knowledge,
    text: string,
    scopes: ScopeExtractResult[],
  ): Promise<void> {
    // Group scopes by hierarchy level based on content analysis
    const hierarchyLevels = this.analyzeHierarchyLevels(scopes);

    // Create knowledge nodes for each level
    for (let level = 0; level < hierarchyLevels.length; level++) {
      const levelScopes = hierarchyLevels[level];

      for (const scope of levelScopes) {
        const childKnowledge = await this.createChildKnowledge(
          parentKnowledge,
          scope,
        );

        // Create sub-knowledge for this scope if it contains nested content
        if (level < hierarchyLevels.length - 1) {
          await this.createSubKnowledgeForScope(childKnowledge, scope, text);
        }
      }
    }
  }

  /**
   * Analyze scopes to determine hierarchy levels
   * @param scopes Array of scopes to analyze
   * @returns Array of arrays, each containing scopes at the same hierarchy level
   */
  private analyzeHierarchyLevels(
    scopes: ScopeExtractResult[],
  ): ScopeExtractResult[][] {
    const hierarchyLevels: ScopeExtractResult[][] = [];

    // Simple heuristic: categorize scopes by content length and complexity
    const sortedScopes = scopes.sort(
      (a, b) => b.abstract.length - a.abstract.length,
    );

    // Create 3 levels of hierarchy
    const level1Count = Math.ceil(sortedScopes.length * 0.3);
    const level2Count = Math.ceil(sortedScopes.length * 0.4);

    hierarchyLevels[0] = sortedScopes.slice(0, level1Count);
    hierarchyLevels[1] = sortedScopes.slice(
      level1Count,
      level1Count + level2Count,
    );
    hierarchyLevels[2] = sortedScopes.slice(level1Count + level2Count);

    return hierarchyLevels;
  }

  /**
   * Create sub-knowledge for a scope
   * @param parentKnowledge The parent knowledge
   * @param scope The scope to create sub-knowledge for
   * @param originalText The original text for reference
   */
  private async createSubKnowledgeForScope(
    parentKnowledge: Knowledge,
    scope: ScopeExtractResult,
    originalText: string,
  ): Promise<void> {
    // Split the scope content into smaller pieces
    const sentences = scope.abstract
      .split(/[。！？.!?]/)
      .filter((s) => s.trim().length > 0);

    // Create sub-knowledge for each sentence or group of sentences
    const subKnowledgeCount = Math.min(3, Math.ceil(sentences.length / 2));

    for (let i = 0; i < subKnowledgeCount; i++) {
      const startIdx = i * Math.ceil(sentences.length / subKnowledgeCount);
      const endIdx = Math.min(
        startIdx + Math.ceil(sentences.length / subKnowledgeCount),
        sentences.length,
      );
      const subContent = sentences.slice(startIdx, endIdx).join('。') + '。';

      if (subContent.trim().length > 10) {
        const subScopeData: ScopeExtractResult = {
          name: `${scope.name} - 子项 ${i + 1}`,
          abstract: subContent.trim(),
        };

        await this.createChildKnowledge(parentKnowledge, subScopeData);
      }
    }
  }

  /**
   * Create a child knowledge node
   * @param parentKnowledge The parent knowledge
   * @param scopeData The scope data for the child knowledge
   * @returns Promise resolving to the created child Knowledge
   */
  private async createChildKnowledge(
    parentKnowledge: Knowledge,
    scopeData: ScopeExtractResult,
  ): Promise<Knowledge> {
    const childKnowledgeData: KnowledgeData = {
      scope: scopeData.name,
      content: scopeData.abstract,
      childKnowledgeId: [],
    };

    const childKnowledge = await parentKnowledge.subdivide(childKnowledgeData);
    this.logger.info('Created child knowledge', {
      parentId: parentKnowledge.get_id(),
      childId: childKnowledge.get_id(),
      scope: scopeData.name,
    });

    return childKnowledge;
  }

  /**
   * Extract knowledge scopes from text using BAML
   * @param mainEntity The main entity name
   * @param text The text to extract scopes from
   * @returns Promise resolving to array of ScopeExtractResult
   */
  private async extractKnowledgeScopes(
    mainEntity: string,
    text: string,
  ): Promise<ScopeExtractResult[]> {
    try {
      const scopes = await b.ExtractScopes(mainEntity, text);
      return scopes;
    } catch (error) {
      this.logger.warn(
        'BAML client failed for scope extraction, using fallback',
        error,
      );

      // Fallback scope extraction when BAML client fails
      return this.extractKnowledgeScopesFallback(mainEntity, text);
    }
  }

  /**
   * Fallback method to extract knowledge scopes when BAML client is unavailable
   * @param mainEntity The main entity name
   * @param text The text to extract scopes from
   * @returns Promise resolving to array of scope results
   */
  private extractKnowledgeScopesFallback(
    mainEntity: string,
    text: string,
  ): ScopeExtractResult[] {
    this.logger.info('Using fallback scope extraction');

    const scopes: ScopeExtractResult[] = [];
    const lines = text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    // Track hierarchy levels using indentation patterns
    let currentHierarchy: {
      level: number;
      title: string;
      content: string;
      parent: number | null;
    }[] = [];

    for (const line of lines) {
      // Determine indentation level
      const indentMatch = line.match(/^(\s*)/);
      const indentLevel = indentMatch ? indentMatch[1].length : 0;

      // Check if line looks like a heading (ends with colon or has specific pattern)
      if (
        line.endsWith(':') ||
        /^[A-Z\u4e00-\u9fff]/.test(line) ||
        indentLevel > 0
      ) {
        const title = line.replace(/:$/, '').trim();

        // Find parent based on indentation
        let parentIndex = -1;
        for (let i = currentHierarchy.length - 1; i >= 0; i--) {
          if (currentHierarchy[i].level < indentLevel) {
            parentIndex = i;
            break;
          }
        }

        // Add to hierarchy
        currentHierarchy.push({
          level: indentLevel,
          title,
          content: '',
          parent: parentIndex >= 0 ? parentIndex : null,
        });
      } else if (currentHierarchy.length > 0 && line.length > 0) {
        // Add content to the last section
        currentHierarchy[currentHierarchy.length - 1].content += line + ' ';
      }
    }

    // Convert hierarchy to scopes, preserving structure
    for (const item of currentHierarchy) {
      if (item.content.trim().length > 0) {
        scopes.push({
          name: item.title,
          abstract: item.content.trim(),
        });
      }
    }

    // If no sections were found, create a default scope
    if (scopes.length === 0) {
      scopes.push({
        name: 'Default Scope',
        abstract: text.trim(),
      });
    }

    this.logger.info(`Fallback extraction found ${scopes.length} scopes`);
    return scopes;
  }

  /**
   * Create a simple knowledge item from text
   * @param text The text to convert to knowledge
   * @param parentEntity The parent entity
   * @param scope Optional scope name
   * @returns Promise resolving to the created Knowledge
   */
  async create_simple_knowledge_from_text(
    text: string,
    parentEntity: Entity,
    scope?: string,
  ): Promise<Knowledge> {
    this.logger.info('Creating simple knowledge from text', {
      entityId: parentEntity.get_id(),
      textLength: text.length,
    });

    try {
      // Extract main entity to get a good scope name if not provided
      let scopeName = scope;
      if (!scopeName) {
        const mainEntity = await this.entityExtractor.extractMainEntity(text);
        scopeName = mainEntity.name;
      }

      // Ensure scopeName is not undefined
      const finalScopeName = scopeName || 'General Knowledge';

      const knowledgeData: KnowledgeData = {
        scope: finalScopeName,
        content: text,
        childKnowledgeId: [],
      };

      const tempKnowledge =
        parentEntity.create_knowledge_with_knowledge_data(knowledgeData);
      const knowledge = await tempKnowledge.save(this.knowledgeStorage);

      this.logger.info('Simple knowledge created', {
        knowledgeId: knowledge.get_id(),
      });
      return knowledge;
    } catch (error) {
      this.logger.error('Error creating simple knowledge', error);
      throw error;
    }
  }

  /**
   * Update existing knowledge with new text
   * @param knowledge The knowledge to update
   * @param newText The new text to incorporate
   * @returns Promise resolving to the updated Knowledge
   */
  async update_knowledge_with_text(
    knowledge: Knowledge,
    newText: string,
  ): Promise<Knowledge> {
    this.logger.info('Updating knowledge with text', {
      knowledgeId: knowledge.get_id(),
      textLength: newText.length,
    });

    try {
      // Extract new scopes from the text
      const currentScope = knowledge.getData().scope;
      const newScopes = await this.extractKnowledgeScopes(
        currentScope,
        newText,
      );

      // Update the main content
      await knowledge.update({
        scope: currentScope,
        content: newText,
      });

      // Add new scopes as child knowledge
      for (const scope of newScopes) {
        await this.createChildKnowledge(knowledge, scope);
      }

      this.logger.info('Knowledge updated successfully');
      return knowledge;
    } catch (error) {
      this.logger.error('Error updating knowledge', error);
      throw error;
    }
  }
}
