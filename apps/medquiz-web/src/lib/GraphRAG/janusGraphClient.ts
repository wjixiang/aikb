import { driver } from 'gremlin';

/**
 * Represents a knowledge graph structure with nodes and edges
 * @interface KnowledgeGraph
 * @property {Array} nodes - Array of graph nodes
 * @property {string} nodes[].id - Node ID
 * @property {string} nodes[].label - Node label/type
 * @property {Record<string, any>} nodes[].properties - Node properties
 * @property {Array} edges - Array of graph edges
 * @property {string} edges[].source - Source node ID
 * @property {string} edges[].target - Target node ID
 * @property {string} edges[].label - Edge label/type
 * @property {Record<string, any>} edges[].properties - Edge properties
 * @property {boolean} is_truncated - Whether graph was truncated due to size limits
 */
interface KnowledgeGraph {
  nodes: Array<{
    id: string;
    label: string;
    properties: Record<string, any>;
  }>;
  edges: Array<{
    source: string;
    target: string;
    label: string;
    properties: Record<string, any>;
  }>;
  is_truncated: boolean;
}

/**
 * Configuration options for connecting to JanusGraph server
 */
export interface JanusGraphConfig {
  /** JanusGraph server hostname or IP address */
  host: string;
  /** JanusGraph server port number */
  port: number;
  /** Optional username for authentication */
  username?: string;
  /** Optional password for authentication */
  password?: string;
  /** Optional traversal source name (defaults to 'g') */
  traversalSource?: string;
}

/**
 * Client for interacting with JanusGraph database
 */
/**
 * Client for interacting with JanusGraph database
 *
 * @class JanusGraphClient
 * @description Provides methods for CRUD operations on JanusGraph including:
 * - Connection management
 * - Vertex/edge operations
 * - Graph traversal queries
 * - Implements BaseGraphStorage interface
 *
 * @example
 * const client = new JanusGraphClient({
 *   host: 'localhost',
 *   port: 8182
 * });
 * await client.connect();
 *
 * // Create vertex
 * await client.createVertex('person', {name: 'Alice'});
 *
 * // Query graph
 * const results = await client.execute('g.V().hasLabel("person")');
 */
export class JanusGraphClient {
  private client: driver.Client;
  private config: JanusGraphConfig;

  /**
   * Creates a new JanusGraph client instance
   * @param config Configuration for connecting to JanusGraph
   */
  constructor(config: JanusGraphConfig) {
    this.config = {
      traversalSource: 'g',
      ...config,
    };

    this.client = new driver.Client(
      `ws://${this.config.host}:${this.config.port}/gremlin`,
      {
        traversalSource: this.config.traversalSource,
        user: this.config.username,
        password: this.config.password,
      },
    );
  }

  /**
   * Establishes connection to JanusGraph server
   * @throws {Error} If connection fails
   */
  async connect(): Promise<void> {
    try {
      await this.client.open();
    } catch (error) {
      throw new Error(`Failed to connect to JanusGraph: ${error}`);
    }
  }

  /**
   * Closes connection to JanusGraph server
   * Logs errors but doesn't throw to allow graceful shutdown
   */
  async disconnect(): Promise<void> {
    try {
      await this.client.close();
    } catch (error) {
      console.error('Error disconnecting from JanusGraph:', error);
    }
  }

  /**
   * Executes a Gremlin query against JanusGraph
   * @param query Gremlin query string
   * @param bindings Optional parameter bindings for the query
   * @returns Query results
   * @throws {Error} If query execution fails
   */
  async execute(query: string, bindings?: Record<string, any>): Promise<any> {
    try {
      const result = await this.client.submit(query, bindings);
      // Return the actual items from the ResultSet
      return result._items;
    } catch (error) {
      throw new Error(`Query execution failed: ${error}`);
    }
  }

  // CRUD Operations
  /**
   * Creates a new vertex in the graph
   * @param label Vertex label/type
   * @param properties Vertex properties as key-value pairs
   * @returns The created vertex
   * @throws {Error} If vertex creation fails
   */
  async createVertex(
    label: string,
    properties: Record<string, any>,
  ): Promise<any> {
    const query = `g.addV('${label}')${this.buildProperties(properties)}`;
    const results = await this.execute(query);
    // addV typically returns the created vertex as the first item
    return results?.[0];
  }

  /**
   * get vertex by id
   * @param id vertex ID
   * @returns
   */
  /**
   * Retrieves a vertex by its ID
   * @param id Vertex ID to retrieve
   * @returns Vertex properties if found, empty object otherwise
   * @throws {Error} If query execution fails
   */
  async getVertex(id: string): Promise<Record<string, any>> {
    const vertexResult = await this.execute(`g.V(${id}).valueMap()`);
    if (!vertexResult || vertexResult.length === 0) {
      return {};
    }

    // Format the properties to extract single values from arrays
    const formattedProps: Record<string, any> = {};
    for (const [key, value] of vertexResult[0]) {
      if (key === 'referenceId') {
        formattedProps[key] = JSON.parse(value[0]);
      } else {
        formattedProps[key] = value.length === 1 ? value[0] : value;
      }
    }
    return formattedProps;
  }

  /**
   * Updates properties of an existing vertex
   * @param id Vertex ID to update
   * @param properties New properties to set
   * @returns Update result
   * @throws {Error} If update fails
   */
  async updateVertex(
    id: string,
    properties: Record<string, any>,
  ): Promise<any> {
    const query = `g.V('${id}')${this.buildProperties(properties)}`;
    return this.execute(query);
  }

  /**
   * Deletes a vertex from the graph
   * @param id Vertex ID to delete
   * @returns Delete result
   * @throws {Error} If deletion fails
   */
  async deleteVertex(name: string): Promise<any> {
    const query = `g.V().has('name', '${name}').drop()`;
    return this.execute(query);
  }

  /**
   * Creates an edge between two vertices
   * @param fromId Source vertex ID
   * @param toId Target vertex ID
   * @param label Edge label/type
   * @param properties Optional edge properties
   * @returns The created edge
   * @throws {Error} If edge creation fails
   */
  async createEdge(
    fromName: string,
    toName: string,
    label: string,
    properties?: Record<string, any>,
  ): Promise<any> {
    let query = `g.V().has('name', '${fromName}').addE('${label}').to(__.V().has('name', '${toName}'))`;
    if (properties && Object.keys(properties).length > 0) {
      query += this.buildProperties(properties);
    }
    const results = await this.execute(query);
    return results?.[0];
  }

  /**
   * Helper method to build Gremlin property assignment string
   * @param properties Key-value pairs of properties
   * @returns Gremlin property assignment string
   */
  /**
   * Helper method to build Gremlin property assignment string
   * @private
   * @param {Record<string, any>} properties - Key-value pairs of properties
   * @returns {string} Gremlin property assignment string
   * @example
   * // Returns: `.property('name','Alice').property('age',30)`
   * buildProperties({name: 'Alice', age: 30})
   */
  private buildProperties(properties: Record<string, any>): string {
    return Object.entries(properties)
      .map(([key, value]) => `.property('${key}', ${JSON.stringify(value)})`)
      .join('');
  }

  /**
   * Finds a vertex by its 'name' property
   * @param name Name value to search for
   * @returns Vertex properties if found, empty object otherwise
   */
  async getVertexByName(name: string): Promise<Record<string, any>> {
    const query = `g.V().has('name', '${name}').valueMap()`;
    const results = await this.execute(query);
    if (!results || results.length === 0) return {};

    const formattedProps: Record<string, any> = {};
    for (const [key, value] of results[0]) {
      if (key === 'referenceId') {
        formattedProps[key] = JSON.parse(value[0]);
      } else {
        formattedProps[key] = value.length === 1 ? value[0] : value;
      }
    }
    return formattedProps;
  }

  /**
   * Gets the degree (number of connections) of a node
   * @param name Node name to check
   * @returns Degree count (0 if node not found)
   */
  /**
   * Gets the degree (number of connections) of a node
   * @param name Node name to check
   * @returns Degree count (0 if node not found)
   * @throws {Error} If query execution fails
   */
  async nodeDegree(name: string): Promise<number> {
    try {
      // First verify the vertex exists
      const exists = await this.execute(
        `g.V().has('name', '${name}').hasNext()`,
      );
      if (!exists) {
        return 0;
      }

      // Count both incoming and outgoing edges
      const query = `g.V().has('name', '${name}').both().count()`;
      const results = await this.execute(query);

      if (!results || results.length === 0) {
        return 0;
      }

      return Number(results[0]) || 0;
    } catch (error) {
      console.error(`Error getting degree for node ${name}:`, error);
      throw new Error(
        `Failed to get node degree: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  /**
   * Finds all text units connected to a node
   * @param name Node name to search from
   * @returns Array of connected text units with their properties
   */
  async findRelatedTextUnits(name: string): Promise<
    Array<{
      content: string;
      referenceId?: string;
      [key: string]: any;
    }>
  > {
    const query = `g.V().has('name', '${name}').out().valueMap()`;
    const results = await this.execute(query);
    return (
      results?.map((item: [string, any[]][]) => {
        const formatted: Record<string, any> = {};
        for (const [key, value] of item) {
          formatted[key] = value.length === 1 ? value[0] : value;
        }
        return formatted;
      }) ?? []
    );
  }

  /**
   * Checks if a node exists in the graph
   * @async
   * @param {string} node_id - The ID of the node to check
   * @returns {Promise<boolean>} True if node exists, false otherwise
   * @throws {Error} If query execution fails
   */
  async has_node(node_name: string): Promise<boolean> {
    const query = `g.V().has('name', '${node_name}').hasNext()`;
    const results = await this.execute(query);
    return results?.[0] ?? false;
  }

  /**
   * Checks if an edge exists between two nodes
   * @async
   * @param {string} source_node_id - Source node ID
   * @param {string} target_node_id - Target node ID
   * @returns {Promise<boolean>} True if edge exists, false otherwise
   * @throws {Error} If query execution fails
   */
  async has_edge(
    source_node_name: string,
    target_node_name: string,
  ): Promise<boolean> {
    const query = `g.V().has('name', '${source_node_name}').outE().where(__.inV().has('name', '${target_node_name}')).hasNext()`;
    const results = await this.execute(query);
    return results?.[0] ?? false;
  }

  // /**
  //  * Gets the degree (number of connected edges) of a node
  //  * @async
  //  * @param {string} node_id - Node ID to check
  //  * @returns {Promise<number>} Number of edges connected to the node
  //  * @throws {Error} If query execution fails
  //  */
  // async node_degree(node_id: string): Promise<number> {
  //   const query = `g.V('${node_id}').both().count()`;
  //   const results = await this.execute(query);
  //   return results?.[0] ?? 0;
  // }

  /**
   * Gets the total degree of an edge (sum of degrees of its nodes)
   * @async
   * @param {string} src_id - Source node ID
   * @param {string} tgt_id - Target node ID
   * @returns {Promise<number>} Sum of degrees of source and target nodes
   * @throws {Error} If query execution fails
   */
  async edge_degree(src_id: string, tgt_id: string): Promise<number> {
    const srcDegree = await this.nodeDegree(src_id);
    const tgtDegree = await this.nodeDegree(tgt_id);
    return srcDegree + tgtDegree;
  }

  /**
   * Gets node properties by ID
   * @async
   * @param {string} node_id - Node ID to retrieve
   * @returns {Promise<Record<string, string> | null>} Node properties if found, null otherwise
   * @throws {Error} If query execution fails
   */
  async get_node(node_id: string): Promise<Record<string, string> | null> {
    const vertex = await this.getVertex(node_id);
    return Object.keys(vertex).length > 0 ? vertex : null;
  }

  /**
   * Gets edge properties between two nodes
   * @async
   * @param {string} source_node_id - Source node ID
   * @param {string} target_node_id - Target node ID
   * @returns {Promise<Record<string, string> | null>} Edge properties if found, null otherwise
   * @throws {Error} If query execution fails
   */
  async get_edge(
    source_node_id: string,
    target_node_id: string,
  ): Promise<Record<string, string> | null> {
    const query = `g.V('${source_node_id}').outE().where(__.inV().hasId('${target_node_id}')).valueMap()`;
    const results = await this.execute(query);
    if (!results || results.length === 0) return null;

    const edgeProps: Record<string, string> = {};
    for (const [key, value] of results[0]) {
      edgeProps[key] = value.length === 1 ? value[0] : value.join(',');
    }
    return edgeProps;
  }

  /**
   * Gets all edges connected to a node
   * @async
   * @param {string} source_node_id - Node ID to get edges for
   * @returns {Promise<[string, string][] | null>} Array of [source,target] tuples, or null if node doesn't exist
   * @throws {Error} If query execution fails
   */
  async get_node_edges(
    source_node_id: string,
  ): Promise<[string, string][] | null> {
    const query = `g.V('${source_node_id}').bothE().project('src', 'tgt').by(outV().id()).by(inV().id())`;
    const results = await this.execute(query);
    if (!results) return null;

    return results.map((edge: { src: string; tgt: string }) => [
      edge.src,
      edge.tgt,
    ]);
  }

  /**
   * Inserts or updates a node in the graph
   * @async
   * @param {string} node_id - Node ID to upsert
   * @param {Record<string, string>} node_data - Node properties
   * @returns {Promise<void>}
   * @throws {Error} If operation fails
   * @note Changes persist on next index_done_callback
   */
  async upsert_node(
    node_id: string,
    node_data: Record<string, string>,
  ): Promise<void> {
    const exists = await this.has_node(node_id);
    if (exists) {
      await this.updateVertex(node_id, node_data);
    } else {
      await this.createVertex('node', { ...node_data, id: node_id });
    }
  }

  /**
   * Inserts or updates an edge between nodes
   * @async
   * @param {string} source_node_id - Source node ID
   * @param {string} target_node_id - Target node ID
   * @param {Record<string, string>} edge_data - Edge properties
   * @returns {Promise<void>}
   * @throws {Error} If operation fails
   * @note Changes persist on next index_done_callback
   */
  async upsert_edge(
    source_node_id: string,
    target_node_id: string,
    edge_data: Record<string, string>,
  ): Promise<void> {
    const exists = await this.has_edge(source_node_id, target_node_id);
    if (exists) {
      // JanusGraph doesn't have direct edge update, so we drop and recreate
      await this.execute(
        `g.V('${source_node_id}').outE().where(__.inV().hasId('${target_node_id}')).drop()`,
      );
    }
    await this.createEdge(source_node_id, target_node_id, 'edge', edge_data);
  }

  /**
   * Deletes a node from the graph
   * @async
   * @param {string} node_id - Node ID to delete
   * @returns {Promise<void>}
   * @throws {Error} If deletion fails
   * @note Changes persist on next index_done_callback
   */
  async delete_node(node_id: string): Promise<void> {
    await this.deleteVertex(node_id);
  }

  /**
   * Deletes multiple nodes
   * @async
   * @param {string[]} nodes - Array of node IDs to delete
   * @returns {Promise<void>}
   * @throws {Error} If deletion fails
   * @note Changes persist on next index_done_callback
   */
  async remove_nodes(nodes: string[]): Promise<void> {
    const query = `g.V(${nodes.map((id) => `'${id}'`).join(',')}).drop()`;
    await this.execute(query);
  }

  /**
   * Deletes multiple edges
   * @async
   * @param {[string, string][]} edges - Array of [source,target] tuples
   * @returns {Promise<void>}
   * @throws {Error} If deletion fails
   * @note Changes persist on next index_done_callback
   */
  async remove_edges(edges: [string, string][]): Promise<void> {
    for (const [src, tgt] of edges) {
      await this.execute(
        `g.V('${src}').outE().where(__.inV().hasId('${tgt}')).drop()`,
      );
    }
  }

  /**
   * Gets all unique node labels in the graph
   * @async
   * @returns {Promise<string[]>} Array of labels sorted alphabetically
   * @throws {Error} If query execution fails
   */
  async get_all_labels(): Promise<string[]> {
    const query = `g.V().label().dedup()`;
    const results = await this.execute(query);
    return results?.sort() ?? [];
  }

  /**
   * Retrieves a connected subgraph of nodes with specified label
   * @async
   * @param {string} node_label - Label of starting nodes (* for all nodes)
   * @param {number} [max_depth=3] - Maximum traversal depth
   * @param {number} [max_nodes=1000] - Maximum nodes to return
   * @returns {Promise<KnowledgeGraph>} Subgraph with nodes, edges and truncation flag
   * @throws {Error} If query execution fails
   * @throws {Error} Not implemented
   */
  async get_knowledge_graph(
    node_label: string,
    max_depth: number = 3,
    max_nodes: number = 1000,
  ): Promise<KnowledgeGraph> {
    // Implementation would depend on KnowledgeGraph type definition
    throw new Error('Not implemented');
  }

  async findRelatedEdges(name: string): Promise<
    Array<{
      src_tgt: [string, string];
      description: string;
      keywords: string[];
      weight: number;
      rank: number;
      created_at: number;
      referenceId?: string;
      [key: string]: any;
    }>
  > {
    // First get the vertex ID
    const vertex = await this.getVertexByName(name);
    if (!vertex || !vertex.id) {
      return [];
    }

    // Then query edges for this vertex
    const query = `g.V(${vertex.id}).bothE().dedup().valueMap().with(WithOptions.tokens)`;

    const results = await this.execute(query);

    if (!results || !Array.isArray(results)) {
      return [];
    }

    return results.map((edgeProps: [string, any[]][]) => {
      const formatted: {
        src_tgt: [string, string];
        description: string;
        keywords: string[];
        weight: number;
        rank: number;
        created_at: number;
        [key: string]: any;
      } = {
        src_tgt: ['', ''],
        description: '',
        keywords: [],
        weight: 0,
        rank: 0,
        created_at: Date.now(),
      };

      // Format edge properties
      for (const [key, value] of edgeProps) {
        if (key === 'referenceId') {
          formatted[key] = JSON.parse(value[0]);
        } else if (key === 'description') {
          formatted.description = value[0] || '';
        } else if (key === 'keywords') {
          formatted.keywords = Array.isArray(value) ? value : [];
        } else if (key === 'weight') {
          formatted.weight = Number(value[0]) || 0;
        } else if (key === 'rank') {
          formatted.rank = Number(value[0]) || 0;
        } else if (key === 'created_at') {
          formatted.created_at = Number(value[0]) || Date.now();
        } else if (key === 'inV') {
          formatted.src_tgt[1] = value[0];
        } else if (key === 'outV') {
          formatted.src_tgt[0] = value[0];
        } else if (key !== 'id' && key !== 'label') {
          formatted[key] = value.length === 1 ? value[0] : value;
        }
      }
      console.log('Formatted edge:', formatted);
      return formatted;
    });
  }
}
