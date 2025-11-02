import Knowledge from '../Knowledge';
import { KnowledgeData, KnowledgeDataWithId } from '../knowledge.type';
import {
  AbstractKnowledgeContentStorage,
  AbstractKnowledgeGraphStorage,
  AbstractKnowledgeStorage,
  AbstractKnowledgeVectorStorage,
} from './abstract-storage';

/**
 * Main storage class for knowledge management that coordinates between different storage types.
 * This class provides a unified interface for creating, retrieving, and managing knowledge
 * by combining content storage, graph storage, and vector storage capabilities.
 */
export default class KnowledgeStorage extends AbstractKnowledgeStorage {
  /**
   * Creates a new KnowledgeStorage instance.
   *
   * @param knowledgeContentStorage - Storage for knowledge content and metadata
   * @param knowledgeGraphStorage - Storage for knowledge relationships and graph structure
   * @param knowledgeVectorStorage - Storage for knowledge vector embeddings
   */
  constructor(
    public knowledgeContentStorage: AbstractKnowledgeContentStorage,
    public knowledgeGraphStorage: AbstractKnowledgeGraphStorage,
    public knowledgeVectorStorage: AbstractKnowledgeVectorStorage,
  ) {
    super();
  }

  /**
   * Creates new knowledge and links it to a source.
   *
   * @param knowledge - The knowledge data to create
   * @param sourceId - The ID of the source this knowledge belongs to
   * @returns Promise resolving to the created knowledge with ID
   */
  async create_new_knowledge(
    knowledge: KnowledgeData,
    sourceId: string,
  ): Promise<KnowledgeDataWithId> {
    // Create knowledge content
    const knowledgeDataWithId =
      await this.knowledgeContentStorage.create_new_knowledge_content({
        ...knowledge,
        childKnowledgeId: knowledge.childKnowledgeId || [],
      });

    // Create link between source and knowledge in graph storage
    await this.knowledgeGraphStorage.create_new_link(
      sourceId,
      knowledgeDataWithId.id,
    );

    return knowledgeDataWithId;
  }

  /**
   * Creates a Knowledge instance from knowledge data, optionally with pre-resolved child knowledge.
   *
   * @param knowledgeData - The knowledge data with ID
   * @param childKnowledge - Optional pre-resolved child knowledge instances
   * @returns Promise resolving to a complete Knowledge instance
   */
  async create_knowledge_instance(
    knowledgeData: KnowledgeDataWithId,
    childKnowledge?: Knowledge[],
  ): Promise<Knowledge> {
    // Use provided child knowledge or resolve from IDs if not provided
    const children =
      childKnowledge ||
      (await this.resolve_child_knowledge(
        knowledgeData.childKnowledgeId || [],
      ));

    const knowledge = new Knowledge(
      knowledgeData.id,
      knowledgeData.scope,
      knowledgeData.content,
      children,
    );

    // Set storage reference for future operations
    (knowledge as any).knowledgeStorage = this;

    return knowledge;
  }

  /**
   * Resolves child knowledge instances from their IDs.
   *
   * @param childKnowledgeIds - Array of child knowledge IDs to resolve
   * @returns Promise resolving to array of resolved Knowledge instances
   */
  async resolve_child_knowledge(
    childKnowledgeIds: string[],
  ): Promise<Knowledge[]> {
    const resolvedKnowledge: Knowledge[] = [];

    for (const childId of childKnowledgeIds) {
      const childKnowledge = await this.get_knowledge_by_id(childId);
      if (childKnowledge) {
        resolvedKnowledge.push(childKnowledge);
      }
    }

    return resolvedKnowledge;
  }

  /**
   * Retrieves knowledge by ID, including all resolved child knowledge.
   *
   * @param knowledgeId - The ID of the knowledge to retrieve
   * @returns Promise resolving to the Knowledge instance or null if not found
   */
  async get_knowledge_by_id(knowledgeId: string): Promise<Knowledge | null> {
    try {
      const retrieved_knowledgeData =
        await this.knowledgeContentStorage.get_knowledge_content_by_id(
          knowledgeId,
        );
      return await this.process_knowledge_with_children(
        retrieved_knowledgeData,
      );
    } catch (error) {
      console.error(`Error getting knowledge by ID ${knowledgeId}:`, error);
      return null;
    }
  }

  /**
   * Processes knowledge data by resolving its children and creating a complete Knowledge instance.
   *
   * @param knowledgeData - The knowledge data with ID to process
   * @returns Promise resolving to a complete Knowledge instance with resolved children
   */
  async process_knowledge_with_children(
    knowledgeData: KnowledgeDataWithId,
  ): Promise<Knowledge> {
    // Resolve child knowledge
    const childKnowledge = await this.resolve_child_knowledge(
      knowledgeData.childKnowledgeId || [],
    );

    // Create and return complete Knowledge instance
    const knowledge = new Knowledge(
      knowledgeData.id,
      knowledgeData.scope,
      knowledgeData.content,
      childKnowledge,
    );

    // Set storage reference for future operations
    (knowledge as any).knowledgeStorage = this;

    return knowledge;
  }
}
