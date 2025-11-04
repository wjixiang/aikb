/**
 * Module for extracting and structuring entities from text using LLMs
 * @module LLMNer
 */

import { JanusGraphClient, JanusGraphConfig } from './janusGraphClient';
import { getChatModel } from '../langchain/provider';
import {
  ENTITY_EXTRACTION_PROMPT,
  ENTITY_EXTRACTION_EXAMPLE,
  CONTINUE_ENTITY_EXTRACTION,
} from './prompt/prompt';
import { ChatOpenAI } from '@langchain/openai';
import { connectToDatabase } from '@/lib/db/mongodb';
import { ReferenceChunk } from './KnowledgeGraphWeaver';

/**
 * Represents an extracted entity with its metadata
 */
export interface entity {
  id: string;
  referenceId: string[];
  name: string;
  alias: string[];
  type: string;
  description: string;
}

export interface relation {
  id: string;
  referenceId: string[];
  entity1: string;
  entity2: string;
  description: string;
  type: string[];
  confidence: number;
}

/**
 * Configuration options for LLMNer
 */
export interface LLMNerOption {
  JanusGraphConfig: JanusGraphConfig;
  extract_llm_modal_name: string;
  language: string;
  tuple_delimiter: string;
  record_delimiter: string;
  completion_delimiter: string;
  debug: boolean;
}

/**
 * LLM-based Named Entity Recognition and Relationship Extraction class
 *
 * This class provides functionality to:
 * - Extract entities and relationships from text using LLMs
 * - Structure the extracted information into a graph-friendly format
 * - Cache LLM responses for auditing and debugging
 */
export default class LLMNer {
  JanusGraphClient: JanusGraphClient;
  config: LLMNerOption;
  chatModel: ChatOpenAI;

  constructor(config: LLMNerOption) {
    this.config = config;
    this.JanusGraphClient = new JanusGraphClient(this.config.JanusGraphConfig);
    this.chatModel = getChatModel()(this.config.extract_llm_modal_name, 0.7);
  }

  /**
   * Extract entities and relationships from text
   * @param chunk - The input chunk to analyze
   * @param entity_types - Array of entity types to extract (e.g. ["疾病","症状","体征"])
   * @returns Structured result containing entities, relationships and keywords
   */
  extract_entities = async (chunk: ReferenceChunk, entity_types: string[]) => {
    const { prompt } = await this.joint_prompt(
      entity_types,
      chunk.content, // Pass chunk.content here
    );

    const result = await this.chatModel.invoke(prompt);

    // save message to mongodb
    this.LLMMessageCacher(result);

    const structured_result = this.structurize(
      result.content.toString(),
      chunk.referenceId,
    );

    // Identify isolated entities
    const all_entity_names = new Set(
      structured_result.entities.map((entity) => entity.name),
    );
    const related_entity_names = new Set<string>();
    structured_result.relationships.forEach((rel) => {
      related_entity_names.add(rel.entity1);
      related_entity_names.add(rel.entity2);
    });

    const isolated_entities = structured_result.entities.filter(
      (entity) => !related_entity_names.has(entity.name),
    );

    if (isolated_entities.length > 0) {
      if (this.config.debug) {
        console.log(
          '######## LLMNer.extract_entities: Isolated entities found, attempting re-extraction ########',
        );
        console.log(
          'Isolated Entities:',
          isolated_entities.map((e) => e.name),
        );
      }

      // Construct prompt for re-extraction
      const isolated_entity_names = isolated_entities
        .map((e) => e.name)
        .join(', ');
      const continue_prompt = await CONTINUE_ENTITY_EXTRACTION[
        'DEFAULT'
      ].format({
        language: this.config.language,
        entity_types: entity_types.join(', '),
        tuple_delimiter: this.config.tuple_delimiter,
        record_delimiter: this.config.record_delimiter,
        completion_delimiter: this.config.completion_delimiter,
        isolated_entities: isolated_entity_names,
        input_text: chunk.content,
      });

      const continue_result = await this.chatModel.invoke(continue_prompt);

      // save message to mongodb
      this.LLMMessageCacher(continue_result);

      const continued_structured_result = this.structurize(
        continue_result.content.toString(),
        chunk.referenceId,
      );

      // Merge results
      const merged_entities = [...structured_result.entities];
      const existing_entity_names_types = new Set(
        merged_entities.map((e) => `${e.name}-${e.type}`),
      );

      continued_structured_result.entities.forEach((new_entity) => {
        if (
          !existing_entity_names_types.has(
            `${new_entity.name}-${new_entity.type}`,
          )
        ) {
          merged_entities.push(new_entity);
        }
      });

      const merged_relationships = [
        ...structured_result.relationships,
        ...continued_structured_result.relationships,
      ];

      structured_result.entities = merged_entities;
      structured_result.relationships = merged_relationships;

      if (this.config.debug) {
        console.log(
          '######## LLMNer.extract_entities: Re-extraction result ########\n',
          continue_result,
        );
        console.log(
          '######## LLMNer.extract_entities: Merged structured result ########',
        );
        console.log(
          'Entities:',
          JSON.stringify(structured_result.entities, null, 2),
        );
        console.log(
          'Relationships:',
          JSON.stringify(structured_result.relationships, null, 2),
        );
      }
    } else {
      if (this.config.debug) {
        console.log(
          '######## LLMNer.extract_entities: No isolated entities found. Skipping re-extraction. ########',
        );
      }
    }

    // Cache the extracted results
    await this.ExtractResultCacher(structured_result);

    if (this.config.debug) {
      console.log(
        '######## LLMNer.extract_entities: prompt ########\n',
        prompt,
      );
      console.log(
        '######## LLMNer.extract_entities: result ########\n',
        result,
      );
    }
    return structured_result;
  };

  /**
   * Construct the prompt for entity extraction
   * @param entity_types - Array of entity types to extract
   * @param input_text - The text to analyze
   * @returns Object containing the constructed prompt and token count estimate
   */
  /**
   * Combine multiple example prompts into a single string
   * @param exampleKeys Array of example prompt keys to combine
   * @returns Combined examples string
   */
  private combineExamples = async (exampleKeys: string[]) => {
    const examples = await Promise.all(
      exampleKeys.map(async (key) => {
        return await ENTITY_EXTRACTION_EXAMPLE[key].format({
          tuple_delimiter: this.config.tuple_delimiter,
          completion_delimiter: this.config.completion_delimiter,
          record_delimiter: this.config.record_delimiter,
        });
      }),
    );
    return examples.join('\n\n');
  };

  joint_prompt = async (entity_types: string[], input_text: string) => {
    // Combine example templates
    const combinedExamples = await this.combineExamples([
      'EXTRACT_DEFINITION',
      'EXTRACT_CLINICAL_PRESENTATION',
      'EXTRACT_PATHOPHYSIOLOGY',
    ]);

    const prompt = await ENTITY_EXTRACTION_PROMPT['DEFAULT'].format({
      language: this.config.language,
      entity_types: entity_types.join(', '),
      tuple_delimiter: this.config.tuple_delimiter,
      record_delimiter: this.config.record_delimiter,
      completion_delimiter: this.config.completion_delimiter,
      examples: combinedExamples,
      input_text,
    });

    // Calculate token count for Chinese text
    // Using approximation: ~2 tokens per Chinese character
    const tokenCount = Math.ceil(prompt.length * 2);
    if (this.config.debug) {
      console.log('LLMNer.joint_prompt: entity_types', entity_types);
      console.log('LLMNer.joint_prompt: input_text', input_text);
      console.log('LLMNer.joint_prompt: prompt', prompt);
      console.log('LLMNer.joint_prompt: tokenCount', tokenCount);
    }
    return {
      prompt,
      tokenCount,
    };
  };

  /**
   * Structure raw LLM output into entities, relationships and keywords
   * @param llm_output_content - Raw output string from LLM
   * @returns Structured data object with:
   *   - entities: Array of extracted entities
   *   - relationships: Array of relationships between entities
   *   - keywords: Array of content keywords
   */
  structurize = (llm_output_content: string, referenceId: string) => {
    const { tuple_delimiter, record_delimiter, completion_delimiter } =
      this.config;
    const entities: any[] = [];
    const relationships: any[] = [];
    let keywords: string[] = [];

    // Escape delimiters for regex usage if they are special characters
    const escapeRegex = (s: string) =>
      s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const escapedTupleDelimiter = escapeRegex(tuple_delimiter);

    // 1. Extract and parse keywords
    // Regex explanation:
    // \\("content_keywords"\\${escapedTupleDelimiter} : Matches the start ("content_keywords"|
    // (.*?)                                         : Captures the keyword string (non-greedy)
    // \\)                                           : Matches the closing parenthesis
    // \\s*                                          : Matches optional whitespace
    // ${completion_delimiter}                       : Matches the completion delimiter (e.g., DONE)
    // $                                             : Anchors to the end of the string
    // Regex explanation:
    // \\("content_keywords"\\${escapedTupleDelimiter} : Matches the start ("content_keywords"|
    // "                                             : Matches the opening double quote
    // (.*?)                                         : Captures the keyword string (non-greedy)
    // "                                             : Matches the closing double quote
    // \\)                                           : Matches the closing parenthesis
    // \\s*                                          : Matches optional whitespace
    // ${completion_delimiter}                       : Matches the completion delimiter (e.g., DONE)
    // $                                             : Anchors to the end of the string
    // Match ("content_keywords"|"KEYWORDS")DONE , capturing only KEYWORDS
    // Match ("content_keywords" | "KEYWORDS")DONE , capturing only KEYWORDS, allowing whitespace around delimiter
    const keywordRegex = new RegExp(
      `\\("content_keywords"\\${escapedTupleDelimiter}\\s*"([^"]*)"\\)\\s*${completion_delimiter}\\s*$`,
    );
    const keywordMatch = llm_output_content.match(keywordRegex);
    // console.log("keywordMatch",keywordMatch)
    let remaining_content = llm_output_content;

    if (keywordMatch && keywordMatch[1]) {
      // keywordMatch[1] now directly contains the keyword string
      const keywordString = keywordMatch[1].trim();
      keywords = keywordString
        .split(',')
        .map((k) => k.trim())
        .filter((k) => k); // Split, trim, and remove empty strings
      // Remove the entire matched pattern from the content
      remaining_content = llm_output_content
        .replace(keywordMatch[0], '')
        .trim();
    } else if (this.config.debug) {
      console.warn(
        'LLMNer.structurize: Keyword line not found or pattern mismatch.',
      );
    }

    // 2. Split remaining content into records
    const records = remaining_content.split(record_delimiter);

    // 3. Process each record
    records.forEach((record) => {
      const cleanedRecord = record.trim();
      if (!cleanedRecord) return; // Skip empty records resulting from split

      // Check if record looks like a tuple (starts with '(' ends with ')')
      if (!cleanedRecord.startsWith('(') || !cleanedRecord.endsWith(')')) {
        if (this.config.debug)
          console.warn(
            'LLMNer.structurize: Skipping malformed record (no parentheses):',
            cleanedRecord,
          );
        return;
      }

      // Remove leading '(' and trailing ')'
      const contentInsideParentheses = cleanedRecord.substring(
        1,
        cleanedRecord.length - 1,
      );

      // Split by tuple delimiter
      const parts = contentInsideParentheses.split(tuple_delimiter);

      // Clean each part (remove surrounding quotes and trim)
      const cleanedParts = parts.map((part) =>
        part.replace(/^"|"$/g, '').trim(),
      );

      if (cleanedParts.length < 1) return; // Skip if split results in no parts

      const recordType = cleanedParts[0];

      try {
        if (recordType === 'entity') {
          if (cleanedParts.length === 4) {
            // "entity", name, type, description
            entities.push({
              id: Math.random().toString(36).substring(2), // Generate a simple ID
              referenceId: [referenceId], // Add the referenceId here
              name: cleanedParts[1],
              alias: [], // Initialize alias as an empty array
              type: cleanedParts[2],
              description: cleanedParts[3],
            });
          } else if (this.config.debug) {
            console.warn(
              'LLMNer.structurize: Malformed entity record:',
              cleanedRecord,
              'Expected 4 parts, got:',
              cleanedParts.length,
              'Parts:',
              cleanedParts,
            );
          }
        } else if (recordType === 'relationship') {
          if (cleanedParts.length === 6) {
            // "relationship", entity1, entity2, description, type, confidence
            const confidence = parseFloat(cleanedParts[5]);
            relationships.push({
              id: Math.random().toString(36).substring(2), // Generate a simple ID
              referenceId: [referenceId], // Add the referenceId here
              entity1: cleanedParts[1],
              entity2: cleanedParts[2],
              description: cleanedParts[3],
              type: cleanedParts[4].split(',').map((e) => e.trim()),
              confidence: isNaN(confidence) ? 0 : confidence, // Parse confidence as float, default 0 if NaN
            });
          } else if (this.config.debug) {
            console.warn(
              'LLMNer.structurize: Malformed relationship record:',
              cleanedRecord,
              'Expected 6 parts, got:',
              cleanedParts.length,
              'Parts:',
              cleanedParts,
            );
          }
        } else if (this.config.debug) {
          // This might catch parts of the keyword line if regex failed
          console.warn(
            'LLMNer.structurize: Unknown record type:',
            recordType,
            'Record:',
            cleanedRecord,
          );
        }
      } catch (error) {
        if (this.config.debug)
          console.error(
            'LLMNer.structurize: Error processing record:',
            cleanedRecord,
            error,
          );
      }
    });

    if (this.config.debug) {
      console.log('######## LLMNer.structurize: Processed Data ########');
      console.log('Entities:', JSON.stringify(entities, null, 2));
      console.log('Relationships:', JSON.stringify(relationships, null, 2));
      console.log('Keywords:', keywords);
    }

    return {
      entities,
      relationships,
      keywords,
    };
  };

  /**
   * Cache LLM messages to MongoDB for auditing and debugging
   * @param ai_message - The LLM response message to cache
   */
  LLMMessageCacher = async (ai_message: any) => {
    try {
      const { db, client } = await connectToDatabase();
      const message_save_collection = db.collection('LLMMessages');
      await message_save_collection.insertOne({
        ...ai_message,
        timestamp: new Date(),
      });
      console.log('[LLMNER] Message saved to MongoDB');
    } catch (e) {
      console.error('[LLMNER] Error saving message to MongoDB', e);
    } finally {
    }
  };

  /**
   * Cache extracted entities and relationships to MongoDB
   * @param result - The structured extraction result containing entities, relationships and keywords
   */
  ExtractResultCacher = async (result: {
    entities: entity[];
    relationships: relation[];
    keywords: string[];
  }) => {
    try {
      const { db, client } = await connectToDatabase();
      const entities_collection = db.collection('Entities');
      const relationships_collection = db.collection('Relationships');

      if (result.entities.length > 0) {
        await entities_collection.insertMany(
          result.entities.map((entity) => ({
            ...entity,
            timestamp: new Date(),
          })),
        );
        console.log(
          `[LLMNER] ${result.entities.length} entities saved to MongoDB`,
        );
      } else {
        console.log('[LLMNER] No entities to save.');
      }

      if (result.relationships.length > 0) {
        await relationships_collection.insertMany(
          result.relationships.map((relation) => ({
            ...relation,
            timestamp: new Date(),
          })),
        );
        console.log(
          `[LLMNER] ${result.relationships.length} relationships saved to MongoDB`,
        );
      } else {
        console.log('[LLMNER] No relationships to save.');
      }
    } catch (e) {
      console.error('[LLMNER] Error saving results to MongoDB', e);
    } finally {
      // Consider closing the client here if it's not managed elsewhere
      // client.close();
    }
  };
}
