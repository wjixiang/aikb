import { semanticSearchResult } from '../../database/chunkStorage';
import Logger from '@/lib/console/logger';
import { b } from '../../../baml_client/async_client';
import { language } from '../../type';
import { Reference } from '@/lib/agents/agent.types';
import TextbookMilvusStorage from '@/kgrag/textbookMilvusStorage';
import { textbookSearchResultItem } from '../../textbookMilvusStorage';
import { Collector, ClientRegistry } from '@boundaryml/baml';
import OpenAI from 'openai';
import { ChatMessage } from '@/lib/agents/agent.types';
import { generateAnswerStream } from '@/lib/LLM/generateAnswerStream';
import { clientRegistry, SupportedLLM } from '@/lib/LLM/LLMProvider';

export interface rag_config {
  useHyDE: boolean;
  useHybrid: boolean;
  useReasoning?: boolean; // Add useReasoning parameter
  topK: number;
  language: language;
  llm?: SupportedLLM; // Optional LLM identifier
}

/**
 * Implements a baseline Retrieval Augmented Generation (RAG) workflow.
 * This function retrieves relevant documents based on a query and then uses
 * a Language Model (LLM) to generate an answer based on the retrieved documents.
 * Optionally uses HyDE (Hypothetical Document Embedding) for retrieval.
 * test script: `src/test_script/test_rag_workflow.ts`
 *
 * @param query - The user's query.
 * @param top_k - The number of top documents to retrieve.
 * @param HyDE - Whether to use HyDE for retrieval (defaults to true).
 * @param language - The language of the query and expected answer (defaults to "zh").
 * @returns A promise that resolves with the generated answer string.
 * @throws If an error occurs during HyDE rewrite, document retrieval, or answer generation.
 */
export default async function rag_workflow(
  query: string,
  config: rag_config,
  messages?: ChatMessage[],
): Promise<{
  stream: any;
  bamlDocuments: Reference[];
  collector: Collector;
}> {
  const logger = new Logger('rag_workflow');
  let retrievalQuery = query;

  if (config.useHyDE) {
    logger.info(
      'HyDE is enabled. Generating hypothetical answer for retrieval.',
    );
    try {
      const hydeResult = await b.HyDE_rewrite(query, config.language);
      retrievalQuery = hydeResult.HyDE_answer;
      logger.info(`HyDE rewritten query: ${retrievalQuery}`);
    } catch (error) {
      logger.error(`Error during HyDE rewrite: ${error}`);
      // Continue with original query if HyDE rewrite fails
    }
  }
  // logger.info(`Retrieving documents for query: ${retrievalQuery}`);
  try {
    // Convert milvus docs to semanticSearchResult format
    const milvusResults: semanticSearchResult[] = [];
    const milvus_retriever = new TextbookMilvusStorage({
      textbook_chunk_mongodb_collection_name: 'pdf_pages',
      textbook_milvus_collection_name: 'textbooks',
      milvus_collection_name: 'textbooks',
      chunk_size: 25,
      chunk_overlap: 200,
      embedding_batch_size: 20,
      milvus_batch_size: 100,
    });

    let docs: textbookSearchResultItem[] = [];
    if (config.useHybrid) {
      logger.debug(`use hybrid`);
      docs = await milvus_retriever.hybridSearch(retrievalQuery, 15, 10);
    } else {
      logger.debug(`use vector`);
      docs = await milvus_retriever.vectorSearch(retrievalQuery, 15, 10);
    }

    if (docs && docs.length > 0) {
      milvusResults.push(
        ...docs.map((doc) => ({
          document: {
            id: doc.id,
            content: doc.content,
            title: doc.pdf_name,
            presigned_url: doc.presigned_url,
            page_number: doc.page_number,
          },
          score: doc.score,
        })),
      );
    } else {
      logger.info(
        'No documents retrieved from Milvus. Proceeding with empty document set to generate response.',
      );
      // This is intentional - we still want to generate a response even when no documents are found
    }
    console.log('文档取回');
    // Combine both result sets

    // Map retrieved documents to the BAML RetrievedDocument type

    // logger.debug(`retrieved documents: ${JSON.stringify(milvusResults,null,2)}`)
    const bamlDocuments: Reference[] = milvusResults.map(
      (doc: semanticSearchResult) => ({
        content: doc.document.content, // Assuming the retrieved document has a 'text' property for content
        score: doc.score,
        title: doc.document.title ?? '',
        presigned_url: doc.document.presigned_url,
        page_number: doc.document.page_number,
      }),
    );

    // console.log('Retrieved documents:', bamlDocuments);
    const collector = new Collector('rag');
    logger.info(
      `Retrieved ${bamlDocuments.length} documents. Generating answer.`,
    );

    const history = messages
      ?.slice(-6)
      .map((e) => e.sender + ' : ' + e.content);
    // const concat_docs = concat_documents(bamlDocuments)
    const concat_docs = bamlDocuments;

    // Format documents for BAML
    const formattedDocs = concat_docs.map((e) => ({
      content: e.content,
      title: e.title,
      page_num: e.page_number,
      metadata: String(e.score),
    }));

    // Create ClientRegistry and get the request
    if (config.llm) {
      clientRegistry.setPrimary(config.llm);
    }
    const req = await b.streamRequest.GenerateAnswer(
      history,
      query,
      formattedDocs,
      config.language,
      { clientRegistry: clientRegistry },
    );
    logger.debug(`req: ${JSON.stringify(req, null, 2)}`);
    const stream = await generateAnswerStream(
      req,
      config.llm ?? 'GLM4Flash',
      config.useReasoning ?? true,
    );

    logger.info('Answer stream initiated.');
    return { stream, bamlDocuments, collector };
  } catch (error) {
    logger.error(
      `Error during document retrieval or answer generation: ${error}`,
    );
    throw error; // Re-throw the error to be handled by the caller
  }
}

export function concat_documents(docs: Reference[]): Reference[] {
  if (!docs || docs.length === 0) return [];

  // Filter documents that have page numbers and parse them
  const docsWithPages = docs
    .filter((doc) => doc.page_number && doc.page_number.trim() !== '')
    .map((doc) => {
      const pageArray = doc
        .page_number!.split('-')
        .map((p) => parseInt(p.trim(), 10));
      return {
        doc,
        startPage: pageArray[0],
        endPage: pageArray[pageArray.length - 1],
      };
    })
    .sort((a, b) => a.startPage - b.startPage);

  if (docsWithPages.length === 0) return docs;

  const mergedDocs: Reference[] = [];
  let currentGroup = [docsWithPages[0]];

  // Group continuous documents
  for (let i = 1; i < docsWithPages.length; i++) {
    const currentDoc = docsWithPages[i];
    const lastDocInGroup = currentGroup[currentGroup.length - 1];

    // Check if current document is continuous with the last one in the group
    // Documents are continuous if the start of current <= end of last + 1
    if (currentDoc.startPage <= lastDocInGroup.endPage + 1) {
      currentGroup.push(currentDoc);
    } else {
      // Merge the current group
      if (currentGroup.length > 0) {
        const merged = mergeDocGroup(currentGroup);
        mergedDocs.push(merged);
      }
      currentGroup = [currentDoc];
    }
  }

  // Merge the last group
  if (currentGroup.length > 0) {
    const merged = mergeDocGroup(currentGroup);
    mergedDocs.push(merged);
  }

  // Add documents without page numbers at the end
  const docsWithoutPages = docs.filter(
    (doc) => !doc.page_number || doc.page_number.trim() === '',
  );
  mergedDocs.push(...docsWithoutPages);

  return mergedDocs;
}

function mergeDocGroup(group: any[]): Reference {
  if (group.length === 1) {
    return group[0].doc;
  }

  const startPage = Math.min(...group.map((item) => item.startPage));
  const endPage = Math.max(...group.map((item) => item.endPage));

  // Combine content from all documents in the group
  const combinedContent = group
    .sort((a, b) => a.startPage - b.startPage)
    .map((item) => item.doc.content)
    .join('\n\n');

  // Use the first document as base, but update page range and content
  const baseDoc = group[0].doc;
  return {
    ...baseDoc,
    content: combinedContent,
    page_number: `${startPage} - ${endPage}`,
  };
}

export async function rag_workflow_sync(
  query: string,
  config: rag_config,
  messages?: ChatMessage[],
): Promise<{
  rag_res: string;
  bamlDocuments: Reference[];
  collector: Collector;
}> {
  const logger = new Logger('rag_workflow');
  let retrievalQuery = query;

  if (config.useHyDE) {
    logger.info(
      'HyDE is enabled. Generating hypothetical answer for retrieval.',
    );
    try {
      const hydeResult = await b.HyDE_rewrite(query, config.language);
      retrievalQuery = hydeResult.HyDE_answer;
      logger.info(`HyDE rewritten query: ${retrievalQuery}`);
    } catch (error) {
      logger.error(`Error during HyDE rewrite: ${error}`);
      // Continue with original query if HyDE rewrite fails
    }
  }
  // logger.info(`Retrieving documents for query: ${retrievalQuery}`);
  try {
    // Convert milvus docs to semanticSearchResult format
    const milvusResults: semanticSearchResult[] = [];
    const milvus_retriever = new TextbookMilvusStorage({
      textbook_chunk_mongodb_collection_name: 'pdf_pages',
      textbook_milvus_collection_name: 'textbooks',
      milvus_collection_name: 'textbooks',
      chunk_size: 25,
      chunk_overlap: 200,
      embedding_batch_size: 20,
      milvus_batch_size: 100,
    });

    let docs: textbookSearchResultItem[] = [];
    if (config.useHybrid) {
      logger.debug(`use hybrid`);
      docs = await milvus_retriever.hybridSearch(retrievalQuery, 15, 10);
    } else {
      logger.debug(`use vector`);
      docs = await milvus_retriever.vectorSearch(retrievalQuery, 15, 10);
    }

    if (docs && docs.length > 0) {
      milvusResults.push(
        ...docs.map((doc) => ({
          document: {
            id: doc.id,
            content: doc.content,
            title: doc.pdf_name,
            presigned_url: doc.presigned_url,
            page_number: doc.page_number,
          },
          score: doc.score,
        })),
      );
    } else {
      logger.info(
        'No documents retrieved from Milvus. Proceeding with empty document set to generate response.',
      );
      // This is intentional - we still want to generate a response even when no documents are found
    }
    console.log('文档取回');
    // Combine both result sets

    // Map retrieved documents to the BAML RetrievedDocument type

    // logger.debug(`retrieved documents: ${JSON.stringify(milvusResults,null,2)}`)
    const bamlDocuments: Reference[] = milvusResults.map(
      (doc: semanticSearchResult) => ({
        content: doc.document.content, // Assuming the retrieved document has a 'text' property for content
        score: doc.score,
        title: doc.document.title ?? '',
        presigned_url: doc.document.presigned_url,
        page_number: doc.document.page_number,
      }),
    );

    // console.log('Retrieved documents:', bamlDocuments);
    const collector = new Collector('rag');
    logger.info(
      `Retrieved ${bamlDocuments.length} documents. Generating answer.`,
    );

    const history = messages
      ?.slice(-6)
      .map((e) => e.sender + ' : ' + e.content);
    // const concat_docs = concat_documents(bamlDocuments)
    const concat_docs = bamlDocuments;

    // Format documents for BAML
    const formattedDocs = concat_docs.map((e) => ({
      content: e.content,
      title: e.title,
      page_num: e.page_number,
      metadata: String(e.score),
    }));

    // Create ClientRegistry and get the request
    if (config.llm) {
      clientRegistry.setPrimary(config.llm);
    }
    const rag_res = await b.GenerateAnswer(
      history,
      query,
      formattedDocs,
      config.language,
      { clientRegistry: clientRegistry },
    );

    return { rag_res, bamlDocuments, collector };
  } catch (error) {
    logger.error(
      `Error during document retrieval or answer generation: ${error}`,
    );
    throw error; // Re-throw the error to be handled by the caller
  }
}
