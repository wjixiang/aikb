import { ChatOpenAI } from '@langchain/openai';
import { getChatModel } from '../langchain/provider';
import { PromptTemplate } from '@langchain/core/prompts';

interface Entity {
  name: string;
  category: string;
}

export default class relationExtractor {
  llm: ChatOpenAI;
  relation_prompt: PromptTemplate;

  constructor(chatModalName: string) {
    this.llm = getChatModel()(chatModalName);
    this.relation_prompt = PromptTemplate.fromTemplate(
      'You are an expert in extracting relations between entities.' +
        'Given a passage and a list of entities, extract the relations between the entities.' +
        'The relations should be in the form of a quintuple: [subject_name, subject_category, predicate, object_name, object_category].' +
        'Passage: {passage}' +
        'Entities: {entities}' +
        'Relations:',
    );
  }

  async relations_extraction(
    passage: string,
    entities: Entity[],
  ): Promise<string[][]> {
    const input = {
      passage: passage,
      entities: JSON.stringify(entities),
    };
    const chain = this.relation_prompt.pipe(this.llm);
    const result = await chain.invoke(input);
    console.log('llm result>', result);

    try {
      // Handle different MessageContent types
      let contentStr = '';
      if (typeof result.content === 'string') {
        contentStr = result.content;
      } else if (Array.isArray(result.content)) {
        contentStr = result.content
          .filter((part: any) => part.type === 'text')
          .map((part: any) => part.text)
          .join('\n');
      }

      // Parse text format like "1. [subject, category, predicate, object, category]"
      const matches = contentStr.match(/\[([^\]]+)\]/g);
      if (!matches) return [['', '', '', '', '']];

      return matches.map((match: string) => {
        const items = match
          .replace(/[\[\]]/g, '')
          .split(',')
          .map((s: string) => s.trim());
        return items.length === 5 ? items : ['', '', '', '', ''];
      });
    } catch (error) {
      console.error('Failed to parse LLM result:', error);
      return [['', '', '', '', '']];
    }
  }
}
