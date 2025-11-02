import {
  computeArgsHash,
  getConversationTurns,
  encodeStringByTiktoken,
} from "./graphrag_utils";
import CacheManager, { cacheType } from "./CacheManager";
import {
  keywords_extraction,
  keywords_extraction_examples,
} from "./prompt/graph_retrieve_prompt";
import milvusCollectionOperator from "../milvus/milvusCollectionOperator";
import { getChatModel } from "../langchain/provider";
import { JanusGraphClient } from "./janusGraphClient";
// Removed incorrect import for CacheData

export interface KnowGraphRetrieverConfig {
  debug?: boolean;
  redisUri?: string;
  chat_modal_name: string;
  exampleNumber: number;
  language: string;
  janusGraphConfig?: {
    host: string;
    port: number;
    username?: string;
    password?: string;
  };
}

export interface QueryParam {
  mode: string;
  conversation_history?: any[]; // Assuming conversation history is an array of messages
  history_turns?: number;
  high_level_keywords?: string[];
  low_level_keywords?: string[];
  model_func?: (...args: any[]) => Promise<any>; // Add model_func based on Python usage
  top_k?: number; // Added based on Python usage
  ids?: string[]; // Added based on Python usage
  max_token_for_local_context?: number; // Added based on Python usage
}

export default class KnowGraphRetriever {
  private cacheManager: CacheManager;
  private debugMode: boolean;
  private config: KnowGraphRetrieverConfig;
  private milvusOperator: milvusCollectionOperator;
  private graphClient?: JanusGraphClient;

  constructor(
    config: KnowGraphRetrieverConfig,
    milvusOperator: milvusCollectionOperator,
  ) {
    this.cacheManager = new CacheManager(config.redisUri);
    this.debugMode = config.debug || false;
    this.config = config;
    this.milvusOperator = milvusOperator;
    if (config.janusGraphConfig) {
      this.graphClient = new JanusGraphClient(config.janusGraphConfig);
    }
  }

  private log(message: string): void {
    if (this.debugMode) {
      console.log(`[KnowGraphRetriever] ${message}`);
    }
  }

  async kg_query(query: string): Promise<any> {}

  /**
     * Retrieves high-level and low-level keywords for RAG operations.
     * This function checks if keywords are already provided in query parameters,
     * and if not, extracts them from the query text using LLM. It also handles caching.
     * test script: `src/script/test-extract-keywords.ts`
     * Args:
        @param query: The user's query text
        @param query_param: Query parameters that may contain pre-defined keywords
        @param hashing_kv: Optional key-value storage for caching results
        @returns A tuple containing (high_level_keywords, low_level_level_keywords)
     */
  async extract_keywords_only(
    query: string,
    query_param: QueryParam, // Use QueryParam type
  ): Promise<[string[], string[]]> {
    // Specify return type as tuple of string arrays
    this.log(`Starting extract_keywords_only for query: "${query}"`);
    this.log(`Query parameters: ${JSON.stringify(query_param)}`);

    // 1. Check if keywords are already provided in query_param
    if (query_param.high_level_keywords || query_param.low_level_keywords) {
      this.log("Keywords provided in query_param, returning directly.");
      this.log(`High-level keywords: ${query_param.high_level_keywords}`);
      this.log(`Low-level keywords: ${query_param.low_level_keywords}`);
      return [
        query_param.high_level_keywords || [],
        query_param.low_level_keywords || [],
      ];
    }

    // 2. Handle cache if needed - add cache type for keywords
    const cacheType: cacheType = "keywords"; // Define cache type
    this.log(`Cache type: ${cacheType}`);
    const args_hash = computeArgsHash(cacheType, query_param.mode, query); // Corrected computeArgsHash call
    this.log(`Cache hash: ${args_hash}`);
    const cachedResponse = await this.cacheManager.get(cacheType, args_hash); // Corrected cacheManager.get call
    if (cachedResponse !== null) {
      this.log(`Cache hit for query: ${query}`);
      this.log(`Cached response: ${cachedResponse}`);
      try {
        const keywordsData = JSON.parse(cachedResponse);
        this.log(`Parsed cached data: ${JSON.stringify(keywordsData)}`);
        return [
          keywordsData.high_level_keywords || [],
          keywordsData.low_level_keywords || [],
        ];
      } catch (e) {
        this.log(
          `Invalid cache format for keywords: ${e}, proceeding with extraction`,
        );
      }
    }

    this.log(
      `Cache miss for query: ${query}. Proceeding with keyword extraction.`,
    );

    // 3. Build the examples
    const exampleNumber = this.config.exampleNumber;
    this.log(`Number of examples to use: ${exampleNumber}`);
    let examples = keywords_extraction_examples.join(
      "\n#############################\n",
    );
    if (exampleNumber && exampleNumber < keywords_extraction_examples.length) {
      examples = keywords_extraction_examples
        .slice(0, exampleNumber)
        .join("\n#############################\n");
    }
    this.log(`Examples used:\n${examples}`);
    const language = this.config.language || "English"; // Assuming default language is English
    this.log(`Language set for extraction: ${language}`);

    // 4. Process conversation history
    let historyContext = "";
    if (query_param.conversation_history) {
      historyContext = getConversationTurns(
        query_param.conversation_history,
        query_param.history_turns,
      );
      this.log(`Conversation history context:\n${historyContext}`);
    } else {
      this.log("No conversation history provided.");
    }

    // 5. Build the keyword-extraction prompt
    const kwPrompt = await keywords_extraction.format({
      query: query,
      examples: examples,
      language: language, // Although not in prompt template, keep for consistency if needed elsewhere
      history: historyContext,
    });
    this.log(`Generated prompt:\n${kwPrompt}`);

    const lenOfPrompts = encodeStringByTiktoken(kwPrompt).length;
    this.log(`Prompt Tokens: ${lenOfPrompts}`);

    // 6. Call the LLM for keyword extraction
    this.log(
      `Calling LLM for keyword extraction with model: ${this.config.chat_modal_name || "glm-4-flash"}`,
    );
    // Assuming getChatModel returns a model instance with an invoke method
    const model = getChatModel()(this.config.chat_modal_name || "glm-4-flash"); // Use getChatModel, assuming a default model name
    const result = await model.invoke(kwPrompt); // Call invoke on the model instance
    this.log(`LLM raw result: ${JSON.stringify(result)}`);

    // 7. Parse out JSON from the LLM response
    this.log("Parsing JSON from LLM response.");
    // Note: The 's' flag for regex requires targeting 'es2018' or later in tsconfig.json
    let resultString = "";
    if (typeof result.content === "string") {
      resultString = result.content;
    } else if (Array.isArray(result.content)) {
      // If content is an array, concatenate text parts.
      // This might need refinement based on the actual structure of MessageContentComplex[]
      resultString = result.content
        .map((part) => {
          if (part.type === "text") {
            return part.text;
          }
          return ""; // Ignore other types like images
        })
        .join("");
    }
    this.log(`LLM response content string: ${resultString}`);

    const match = resultString.match(/\{.*\}/s);
    if (!match) {
      this.log("No JSON-like structure found in the LLM respond.");
      return [[], []];
    }
    this.log(`Matched JSON string: ${match[0]}`);
    let keywordsData: {
      high_level_keywords?: string[];
      low_level_keywords?: string[];
    };
    try {
      keywordsData = JSON.parse(match[0]);
      this.log(`Parsed keywords data: ${JSON.stringify(keywordsData)}`);
    } catch (e) {
      this.log(`JSON parsing error: ${e}`);
      return [[], []];
    }

    const hlKeywords = keywordsData.high_level_keywords || [];
    const llKeywords = keywordsData.low_level_keywords || [];

    this.log(`Extracted high-level keywords: ${hlKeywords}`);
    this.log(`Extracted low-level keywords: ${llKeywords}`);

    // 8. Cache only the processed keywords with cache type
    if (hlKeywords.length > 0 || llKeywords.length > 0) {
      this.log(`Caching keywords with hash: ${args_hash}`);
      const cacheData = {
        high_level_keywords: hlKeywords,
        low_level_keywords: llKeywords,
      };
      await this.cacheManager.set(
        cacheType, // Corrected cacheManager.set call
        args_hash,
        cacheData,
      );
      this.log("Keywords cached successfully.");
    } else {
      this.log("No keywords extracted, skipping cache.");
    }

    this.log("Finished extract_keywords_only.");
    return [hlKeywords, llKeywords];
  }

  // Placeholder for missing helper function
  private async _find_most_related_text_unit_from_entities(
    node_datas: any[],
    query_param: QueryParam,
  ): Promise<any[]> {
    if (!this.graphClient) {
      this.log("JanusGraphClient not initialized, skipping text unit search");
      return [];
    }

    const results = [];
    for (const node of node_datas) {
      const textUnits = await this.graphClient.findRelatedTextUnits(
        node.entity_name,
      );
      results.push(...textUnits);
    }
    return results;
  }

  private async _find_most_related_edges_from_entities(
    node_datas: any[],
    query_param: QueryParam,
  ): Promise<any[]> {
    if (!this.graphClient) {
      this.log("JanusGraphClient not initialized, skipping edge search");
      return [];
    }

    const results = [];
    for (const node of node_datas) {
      const edges = await this.graphClient.findRelatedEdges(node.entity_name);
      results.push(...edges);
    }
    return results;
  }
  async build_query_context() {}

  async get_node_data(
    query: string,
    query_param: QueryParam,
  ): Promise<[string, string, string]> {
    this.log(`Starting get_node_data for query: "${query}"`);
    this.log(`Query parameters: ${JSON.stringify(query_param)}`);

    // get similar entities
    this.log(`Query nodes: ${query}, top_k: ${query_param.top_k}`);

    /**
     * Retrieve similar documents from Milvus
     */
    const searchResult = await this.milvusOperator.searchSimilarDocuments(
      query,
      {
        limit: query_param.top_k,
        expr: query_param.ids
          ? `oid in [${query_param.ids.map((id) => `"${id}"`).join(",")}]`
          : undefined,
      },
    );
    const results = searchResult.documents.map((doc, index) => ({
      entity_name: doc.title || doc.oid,
      score: searchResult.distances[index], // Placeholder score since milvus returns distances separately, if it reture score correctly, need to make comments for searchResult interface
    }));

    if (!results || results.length === 0) {
      this.log("No entities found for the query.");
      return ["", "", ""];
    }

    // get entity information
    const nodeDataPromises = results.map(
      (r: any) =>
        this.graphClient?.getVertexByName(r.entity_name) ??
        Promise.resolve(null),
    );
    const nodeDegreePromises = results.map(
      (r: any) =>
        this.graphClient?.nodeDegree(r.entity_name) ?? Promise.resolve(0),
    );

    const [node_datas_raw, node_degrees] = await Promise.all([
      Promise.all(nodeDataPromises),
      Promise.all(nodeDegreePromises),
    ]);

    const node_datas = node_datas_raw
      .map((n: any, index: number) => {
        if (n === null) {
          this.log(
            `Warning: Node data missing for entity: ${results[index].entity_name}`,
          );
          return null;
        }
        return {
          ...n,
          entity_name: results[index].entity_name,
          rank: node_degrees[index],
        };
      })
      .filter((n: any) => n !== null);

    if (node_datas.length === 0) {
      this.log("All retrieved nodes were missing data.");
      return ["", "", ""];
    }

    // get entity text chunk and relations
    // Assuming these functions exist and are imported or defined elsewhere and return data with the expected properties
    const [use_text_units, use_relations] = await Promise.all([
      this._find_most_related_text_unit_from_entities(node_datas, query_param),
      this._find_most_related_edges_from_entities(node_datas, query_param),
    ]);

    const len_node_datas_before_truncate = node_datas.length;
    // Assuming truncate_list_by_token_size is available
    // const truncated_node_datas = truncate_list_by_token_size(
    //     node_datas,
    //     (x: any) => x.description ?? "",
    //     query_param.max_token_for_local_context
    // );
    const truncated_node_datas = node_datas; // Placeholder for truncation

    this.log(
      `Truncate entities from ${len_node_datas_before_truncate} to ${truncated_node_datas.length} (max tokens:${query_param.max_token_for_local_context})`,
    );

    this.log(
      `Local query uses ${truncated_node_datas.length} entities, ${use_relations.length} relations, ${use_text_units.length} chunks`,
    );

    // build prompt context strings
    const entities_section_list: (string | number)[][] = [
      [
        "id",
        "entity",
        "type",
        "description",
        "rank",
        "created_at",
        "referenceId",
      ],
    ];
    for (let i = 0; i < truncated_node_datas.length; i++) {
      const n = truncated_node_datas[i];
      const createdAt = n.created_at ?? "UNKNOWN";
      let formattedCreatedAt = createdAt;
      if (typeof createdAt === "number") {
        // Assuming a function to format timestamp exists or using built-in Date
        formattedCreatedAt = new Date(createdAt * 1000).toISOString(); // Example formatting
      }

      const referenceId = n.referenceId ?? "unknown_source";

      entities_section_list.push([
        i,
        n.entity_name,
        n.entity_type ?? "UNKNOWN",
        n.description ?? "UNKNOWN",
        n.rank,
        formattedCreatedAt,
        referenceId,
      ]);
    }
    // Assuming list_of_list_to_csv is available
    // const entities_context = list_of_list_to_csv(entities_section_list);
    const entities_context = entities_section_list
      .map((row) => row.join(","))
      .join("\n"); // Placeholder for CSV conversion

    const relations_section_list: (string | number)[][] = [
      [
        "id",
        "source",
        "target",
        "description",
        "keywords",
        "weight",
        "rank",
        "created_at",
        "referenceId",
      ],
    ];

    for (let i = 0; i < use_relations.length; i++) {
      const e = use_relations[i]; // Assuming e is an object with a 'created_at' property
      const createdAt = e.created_at ?? "UNKNOWN";
      let formattedCreatedAt = createdAt;
      if (typeof createdAt === "number") {
        // Assuming a function to format timestamp exists or using built-in Date
        formattedCreatedAt = new Date(createdAt * 1000).toISOString(); // Example formatting
      }

      const filePath = e.referenceId ?? "unknown_source";

      relations_section_list.push([
        i,
        e.src_tgt[0],
        e.src_tgt[1],
        e.description,
        e.keywords,
        e.weight,
        e.rank,
        formattedCreatedAt,
        filePath,
      ]);
    }
    // Assuming list_of_list_to_csv is available
    // const relations_context = list_of_list_to_csv(relations_section_list);
    const relations_context = relations_section_list
      .map((row) => row.join(","))
      .join("\n"); // Placeholder for CSV conversion

    const text_units_section_list: (string | number)[][] = [
      ["id", "content", "referenceId"],
    ];
    for (let i = 0; i < use_text_units.length; i++) {
      const t = use_text_units[i];
      text_units_section_list.push([
        i,
        t.content,
        t.referenceId ?? "unknown_source",
      ]);
    }
    // Assuming list_of_list_to_csv is available
    // const text_units_context = list_of_list_to_csv(text_units_section_list);
    const text_units_context = text_units_section_list
      .map((row) => row.join(","))
      .join("\n"); // Placeholder for CSV conversion

    this.log("Finished get_node_data.");
    return [entities_context, relations_context, text_units_context];
  }
}
