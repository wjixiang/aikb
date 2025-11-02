import { BaseChain, ChainInputs } from "langchain/chains";
import { BaseRetriever } from "@langchain/core/retrievers";
import { Document } from "@langchain/core/documents";
import { CallbackManagerForChainRun } from "@langchain/core/callbacks/manager";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { NoteRetriever } from "../hybridRetriever";
import { getChatModel } from "../provider";
import { DEFAULT_SYSTEM_PROMPT } from "../prompt";

export interface QuizAnalysisChainInput extends ChainInputs {}

export class QuizAnalysisChain extends BaseChain {
  static lc_name() {
    return "QuizAnalysisChain";
  }

  retriever: NoteRetriever;
  private summaryPrompt: ChatPromptTemplate;

  constructor(fields: QuizAnalysisChainInput) {
    super(fields);
    this.retriever = new NoteRetriever({
      minSimilarityScore: 0.01,
      maxK: 10,
      salientTerms: [],
    });
    this.summaryPrompt = ChatPromptTemplate.fromTemplate(
      DEFAULT_SYSTEM_PROMPT +
        `
      Query: {query}
      
      Documents:
      {documents}
      
      Summary:`,
    );
  }

  get inputKeys() {
    return ["query"];
  }

  get outputKeys() {
    return ["documents", "summary"];
  }

  _chainType() {
    return "quiz_analysis" as const;
  }

  async _call(
    values: { query: string },
    runManager?: CallbackManagerForChainRun,
  ): Promise<{ documents: Document[]; summary: string }> {
    const { query } = values;

    // Retrieve relevant documents
    const documents = await this.retriever.getRelevantDocuments(query);

    // Generate summary if documents found
    let summary = "No relevant documents found";
    if (documents.length > 0) {
      const docContents = documents
        .map((d) => d.pageContent)
        .join("\n\n---\n\n");
      const formattedPrompt = await this.summaryPrompt.format({
        query,
        documents: docContents,
      });
      const model = getChatModel()("deepseek-v3", 0.7);
      summary = (await model.invoke(formattedPrompt)).content as string;
    }

    return { documents, summary };
  }
}
