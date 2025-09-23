import Knowledge from '../Knowledge';
import { KnowledgeData, KnowledgeDataWithId } from '../knowledge.type';
import {
  AbstractKnowledgeContentStorage,
  AbstractKnowledgeGraphStorage,
  AbstractKnowledgeStorage,
  AbstractKnowledgeVectorStorage,
} from './abstract-storage';

export default class KnowledgeStorage extends AbstractKnowledgeStorage {
  constructor(
    public knowledgeContentStorage: AbstractKnowledgeContentStorage,
    public knowledgeGraphStorage: AbstractKnowledgeGraphStorage,
    public knowledgeVectorStorage: AbstractKnowledgeVectorStorage,
  ) {
    super();
  }

  async create_new_knowledge(
    knowledge: KnowledgeData,
    sourceId: string,
  ): Promise<KnowledgeDataWithId> {
    // Generate ID for the knowledge
    const knowledgeId = AbstractKnowledgeStorage.generate_knowledge_id();

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

    return new Knowledge(
      knowledgeData.id,
      knowledgeData.scope,
      knowledgeData.content,
      children,
    );
  }

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

  async get_knowledge_by_id(knowledgeId: string): Promise<Knowledge | null> {
    try {
      const retrieved_knowledgeData = await this.knowledgeContentStorage.get_knowledge_content_by_id(knowledgeId)
      return await this.process_knowledge_with_children(retrieved_knowledgeData);
    } catch (error) {
      console.error(`Error getting knowledge by ID ${knowledgeId}:`, error);
      return null;
    }
  }

  async process_knowledge_with_children(
    knowledgeData: KnowledgeDataWithId,
  ): Promise<Knowledge> {
    // Resolve child knowledge
    const childKnowledge = await this.resolve_child_knowledge(
      knowledgeData.childKnowledgeId || [],
    );

    // Create and return complete Knowledge instance
    return new Knowledge(
      knowledgeData.id,
      knowledgeData.scope,
      knowledgeData.content,
      childKnowledge,
    );
  }
}
