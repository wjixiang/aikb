import { b } from '../../baml_client';
import { EntityExtractResult } from '../../baml_client/types';
import createLoggerWithPrefix from '../../lib/logger';

/**
 * Class for extracting entities and relationships from natural language text
 */
export class EntityExtractor {
  private logger = createLoggerWithPrefix('EntityExtractor');

  /**
   * Extract the main entity from natural language text
   * @param text The text to extract the main entity from
   * @returns Promise resolving to the main entity information
   */
  async extractMainEntity(text: string): Promise<EntityExtractResult> {
    this.logger.info('Extracting main entity', { textLength: text.length });

    try {
      const entity = await b.ExtractMainEntity(text);
      this.logger.info('Main entity extracted', { entityName: entity.name });
      return entity;
    } catch (error) {
      this.logger.warn('BAML client failed, using fallback extraction', error);

      // Fallback extraction when BAML client fails
      return this.extractMainEntityFallback(text);
    }
  }

  /**
   * Fallback method to extract main entity when BAML client is unavailable
   * @param text The text to extract the main entity from
   * @returns Promise resolving to the main entity information
   */
  private extractMainEntityFallback(text: string): EntityExtractResult {
    this.logger.info('Using fallback entity extraction');

    // Simple heuristic extraction
    const lines = text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    // Look for the first non-empty line that looks like a title/heading
    for (const line of lines) {
      // Check if line ends with colon or looks like a heading
      if (line.endsWith(':') || /^[A-Z\u4e00-\u9fff]/.test(line)) {
        const title = line.replace(/:$/, '').trim();
        const content = lines
          .slice(lines.indexOf(line) + 1)
          .join(' ')
          .trim();

        return {
          name: title,
          category: 'General',
          abstract:
            content.substring(0, 200) + (content.length > 200 ? '...' : ''),
        };
      }
    }

    // If no clear heading found, use the first line as title
    const firstLine = lines[0] || 'Unknown Entity';
    const remainingContent = lines.slice(1).join(' ').trim();

    return {
      name: firstLine,
      category: 'General',
      abstract:
        remainingContent.substring(0, 200) +
        (remainingContent.length > 200 ? '...' : ''),
    };
  }

  /**
   * Extract related entities from text
   * @param text The text to extract entities from
   * @param mainEntityName The main entity name to filter related entities
   * @returns Promise resolving to array of related entities
   */
  async extractRelatedEntities(
    text: string,
    mainEntityName?: string,
  ): Promise<EntityExtractResult[]> {
    this.logger.info('Extracting related entities', {
      textLength: text.length,
      mainEntityName,
    });

    try {
      // For now, we'll use the main entity extraction multiple times
      // In a more advanced implementation, this could use a different BAML function
      const mainEntity = await this.extractMainEntity(text);

      // Return the main entity as the only related entity for now
      // This could be enhanced to extract multiple entities in the future
      const relatedEntities = [mainEntity];

      this.logger.info('Related entities extracted', {
        count: relatedEntities.length,
      });
      return relatedEntities;
    } catch (error) {
      this.logger.error('Error extracting related entities', error);
      throw error;
    }
  }

  /**
   * Extract relationships between entities
   * @param text The text to extract relationships from
   * @param entities The entities to find relationships between
   * @returns Promise resolving to array of relationships
   */
  async extractRelationships(
    text: string,
    entities: EntityExtractResult[],
  ): Promise<
    Array<{
      source: string;
      target: string;
      relationType: string;
      confidence: number;
    }>
  > {
    this.logger.info('Extracting relationships', {
      textLength: text.length,
      entityCount: entities.length,
    });

    try {
      // For now, we'll implement a simple relationship extraction
      // In a more advanced implementation, this could use a dedicated BAML function
      const relationships: Array<{
        source: string;
        target: string;
        relationType: string;
        confidence: number;
      }> = [];

      // Simple heuristic: if entity names appear close together in text, they might be related
      const words = text.toLowerCase().split(/\s+/);

      for (let i = 0; i < entities.length; i++) {
        for (let j = i + 1; j < entities.length; j++) {
          const entity1 = entities[i].name.toLowerCase();
          const entity2 = entities[j].name.toLowerCase();

          const entity1Index = words.findIndex((word) =>
            word.includes(entity1),
          );
          const entity2Index = words.findIndex((word) =>
            word.includes(entity2),
          );

          if (entity1Index !== -1 && entity2Index !== -1) {
            const distance = Math.abs(entity1Index - entity2Index);

            // If entities are close in the text, consider them related
            if (distance < 20) {
              relationships.push({
                source: entities[i].name,
                target: entities[j].name,
                relationType: 'related_to',
                confidence: Math.max(0.1, 1 - distance / 20),
              });
            }
          }
        }
      }

      this.logger.info('Relationships extracted', {
        count: relationships.length,
      });
      return relationships;
    } catch (error) {
      this.logger.error('Error extracting relationships', error);
      throw error;
    }
  }

  /**
   * Analyze text structure to identify potential knowledge sections
   * @param text The text to analyze
   * @returns Promise resolving to array of potential sections
   */
  async analyzeTextStructure(text: string): Promise<
    Array<{
      title: string;
      content: string;
      startPosition: number;
      endPosition: number;
    }>
  > {
    this.logger.info('Analyzing text structure', { textLength: text.length });

    try {
      const sections: Array<{
        title: string;
        content: string;
        startPosition: number;
        endPosition: number;
      }> = [];

      // Simple text structure analysis
      // Look for headings, paragraphs, etc.
      const lines = text.split('\n');
      let currentSection: {
        title: string;
        content: string;
        startPosition: number;
        endPosition: number;
      } | null = null;
      let currentPosition = 0;

      for (const line of lines) {
        const trimmedLine = line.trim();

        // Check if this line looks like a heading
        if (
          trimmedLine.length > 0 &&
          (trimmedLine.endsWith(':') ||
            /^[A-Z]/.test(trimmedLine) ||
            trimmedLine.length < 50)
        ) {
          // Save previous section if it exists
          if (currentSection) {
            currentSection.endPosition = currentPosition;
            sections.push(currentSection);
          }

          // Start new section - extract only the title part before the colon
          const titleMatch = trimmedLine.match(/^([^:]+):?/);
          const title = titleMatch ? titleMatch[1].trim() : trimmedLine;

          currentSection = {
            title: title,
            content: '',
            startPosition: currentPosition,
            endPosition: currentPosition,
          };
        } else if (currentSection && trimmedLine.length > 0) {
          // Add content to current section
          currentSection.content += line + '\n';
        }

        currentPosition += line.length + 1; // +1 for newline
      }

      // Add the last section
      if (currentSection) {
        currentSection.endPosition = currentPosition;
        sections.push(currentSection);
      }

      this.logger.info('Text structure analyzed', {
        sectionCount: sections.length,
      });
      return sections;
    } catch (error) {
      this.logger.error('Error analyzing text structure', error);
      throw error;
    }
  }
}
