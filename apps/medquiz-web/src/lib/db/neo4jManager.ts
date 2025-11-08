import neo4j, { Record } from 'neo4j-driver';
import type { Driver } from 'neo4j-driver';
import { remark } from 'remark';
import { visit } from 'unist-util-visit';
import wikiLinkPlugin from 'remark-wiki-link';

interface NoteNodeProperties {
  oid: string;
  fileName?: string;
  content?: string;
  metaData?: object;
  title?: string;
}

interface GenericNodeProperties {
  [key: string]: any;
}

/**
 * A manager class for handling Neo4j database operations including:
 * - Executing Cypher queries
 * - Processing markdown files into graph nodes and relationships
 * - Managing database connections
 */
export class Neo4jManager {
  private driver: Driver;

  /**
   * Creates a new Neo4jManager instance
   * @param neo4jUri - The Neo4j database URI (e.g. 'bolt://localhost:7687')
   * @param neo4jUsername - The username for database authentication
   * @param neo4jPassword - The password for database authentication
   */
  constructor(
    private neo4jUri: string,
    private neo4jUsername: string,
    private neo4jPassword: string,
  ) {
    this.driver = neo4j.driver(
      this.neo4jUri,
      neo4j.auth.basic(this.neo4jUsername, this.neo4jPassword),
    );
  }

  /**
   * Executes a Cypher query against the Neo4j database
   * @param query - The Cypher query string to execute
   * @returns A Promise that resolves with the query result
   * @throws Will throw an error if the query execution fails
   */
  async executeQuery(query: string, parameters: object = {}) {
    const session = this.driver.session();
    try {
      const result = await session.run(query, parameters);
      console.log('Query results:');
      result.records.forEach((record: Record) => {
        console.log(record.toObject());
      });
      return result;
    } catch (error) {
      console.error('Error executing query:', error);
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * Processes markdown files into Neo4j graph nodes and relationships
   * @param files - Array of objects containing file paths and contents
   * @returns A Promise that resolves when all files are processed
   * @throws Will throw an error if file processing fails
   *
   * For each markdown file:
   * 1. Creates/updates a Note node with the file content
   * 2. Parses wiki-style links in the markdown
   * 3. Creates relationships between linked notes
   */
  async processMarkdownFiles(
    files: Array<{
      title: string;
      content: string;
      oid?: string;
      metaData?: object;
    }>,
  ) {
    for (const file of files) {
      const session = this.driver.session();
      const tx = session.beginTransaction();
      try {
        const fileName = file.title;
        const content = file.content;
        const oid = file.oid || fileName; // Use oid if provided, fallback to fileName

        // Create/update node for current file
        await tx.run(
          `MERGE (n:Note {oid: $oid})
           SET n.title = $title,
               n.content = $content,
               n.metaData = $metaData`,
          {
            oid,
            title: fileName,
            content,
            metaData: file.metaData ? JSON.stringify(file.metaData) : null,
          },
        );

        // Parse markdown for links
        const ast = remark().use(wikiLinkPlugin).parse(content);

        const linkPromises: Promise<void>[] = [];

        visit(ast, 'wikiLink', (node: any) => {
          const linkedFile = node.data.alias || node.value;
          console.log(`Found link from ${fileName} to ${linkedFile}`);

          // Create relationship promise
          linkPromises.push(
            tx
              .run(
                `MATCH (a:Note {oid: $sourceOid})
               MERGE (b:Note {title: $targetTitle})
               ON CREATE SET b.content = ''
               MERGE (a)-[:LINKS_TO]->(b)`,
                {
                  sourceOid: oid,
                  targetTitle: linkedFile,
                },
              )
              .then(() => {
                console.log(
                  `Created relationship: ${fileName} -> ${linkedFile}`,
                );
              })
              .catch((err: Error) => {
                console.error(
                  `Failed to create relationship ${fileName} -> ${linkedFile}:`,
                  err,
                );
              }),
          );
        });

        // Wait for all relationships to be created
        await Promise.all(linkPromises);
        await tx.commit();
        console.log(`Finished processing file: ${fileName}`);
      } catch (error) {
        await tx.rollback();
        console.error(`Error processing file ${file.title}:`, error);
        throw error;
      } finally {
        await session.close();
      }
    }
  }

  /**
   * Closes the Neo4j driver connection
   * @returns A Promise that resolves when the connection is closed
   */
  /**
   * Creates a new node with the given properties
   * @param label - The node label (e.g. 'Person')
   * @param properties - The node properties
   * @returns Created node ID
   */
  async createNode(
    label: string,
    properties: NoteNodeProperties | GenericNodeProperties,
  ) {
    const session = this.driver.session();
    try {
      // Handle special cases for Note nodes
      if (label === 'Note') {
        const { oid, fileName, content, metaData } =
          properties as NoteNodeProperties;

        // Delegate Note node creation entirely to processMarkdownFiles
        if (content) {
          await this.processMarkdownFiles([
            {
              title: fileName || oid,
              content,
              oid,
              metaData,
            },
          ]);

          // Return the oid as node identifier since processMarkdownFiles uses MERGE
          return oid;
        }

        // Fallback for Notes without content
        const result = await session.run(
          `MERGE (n:Note {oid: $oid})
           SET n.fileName = $fileName,
               n.metaData = $metaData
           RETURN id(n) as id`,
          { oid, fileName, metaData },
        );
        return result.records[0].get('id').toString();
      }

      // Default case for other node types
      const result = await session.run(
        `CREATE (n:${label} $props) RETURN id(n) as id`,
        { props: properties },
      );
      return result.records[0].get('id').toString();
    } catch (error) {
      console.error(`Error creating ${label} node:`, error);
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * Updates properties of an existing node
   * @param nodeId - The node ID to update
   * @param properties - New properties to set
   */
  async updateNode(nodeId: string, properties: object) {
    const session = this.driver.session();
    try {
      await session.run(`MATCH (n) WHERE id(n) = $id SET n += $props`, {
        id: parseInt(nodeId),
        props: properties,
      });
    } finally {
      await session.close();
    }
  }

  /**
   * Deletes a node by ID
   * @param nodeId - The node ID to delete
   */
  async deleteNode(nodeId: string) {
    const session = this.driver.session();
    try {
      await session.run(`MATCH (n) WHERE id(n) = $id DELETE n`, {
        id: parseInt(nodeId),
      });
    } finally {
      await session.close();
    }
  }

  /**
   * Creates a relationship between two nodes
   * @param sourceId - Source node ID
   * @param targetId - Target node ID
   * @param type - Relationship type
   * @param properties - Relationship properties
   */
  async createRelationship(
    sourceId: string,
    targetId: string,
    type: string,
    properties: object = {},
  ) {
    const session = this.driver.session();
    try {
      await session.run(
        `MATCH (a), (b) 
         WHERE id(a) = $sourceId AND id(b) = $targetId
         CREATE (a)-[r:${type} $props]->(b)`,
        {
          sourceId: parseInt(sourceId),
          targetId: parseInt(targetId),
          props: properties,
        },
      );
    } finally {
      await session.close();
    }
  }

  /**
   * Finds nodes by label and optional properties
   * @param label - Node label to search for
   * @param properties - Optional properties to filter by
   * @returns Array of matching nodes
   */
  async findNodes(label: string, properties: object = {}) {
    const session = this.driver.session();
    try {
      const result = await session.run(
        `MATCH (n:${label} ${
          Object.keys(properties).length
            ? '{' +
              Object.keys(properties)
                .map((k) => `${k}: $${k}`)
                .join(', ') +
              '}'
            : ''
        }) RETURN n`,
        Object.keys(properties).length ? properties : {},
      );
      return result.records.map((r) => {
        const node = r.get('n').properties;
        if (node.metaData && typeof node.metaData === 'string') {
          node.metaData = JSON.parse(node.metaData);
        }
        return node;
      });
    } finally {
      await session.close();
    }
  }

  /**
   * Gets all relationships for a node
   * @param nodeId - The node ID
   * @returns Array of relationships with their start/end nodes
   */
  async getNodeRelationships(nodeId: string): Promise<
    Array<{
      type: string;
      properties: object;
      startId: string;
      endId: string;
    }>
  > {
    const session = this.driver.session();
    try {
      const result = await session.run(
        `MATCH (a)-[r]-(b) 
         WHERE id(a) = $id OR id(b) = $id
         RETURN type(r) as type, properties(r) as props, 
                id(startNode(r)) as startId, id(endNode(r)) as endId`,
        { id: parseInt(nodeId) },
      );
      return result.records.map((r) => ({
        type: r.get('type'),
        properties: r.get('props'),
        startId: r.get('startId').toString(),
        endId: r.get('endId').toString(),
      }));
    } finally {
      await session.close();
    }
  }

  async close() {
    await this.driver.close();
  }

  /**
   * Creates multiple nodes in a single transaction
   * @param label - The node label (e.g. 'Note')
   * @param nodes - Array of node properties
   * @returns Array of created node IDs
   */
  async bulkCreateNodes(
    label: string,
    nodes: NoteNodeProperties[] | GenericNodeProperties[],
  ): Promise<string[]> {
    const session = this.driver.session();
    const tx = session.beginTransaction();
    try {
      // Special handling for Note nodes
      if (label === 'Note') {
        const noteNodes = nodes as NoteNodeProperties[];
        await this.processMarkdownFiles(
          noteNodes.map((n) => ({
            title: n.fileName || n.oid,
            content: n.content || '',
            oid: n.oid,
            metaData: n.metaData,
          })),
        );

        // Return oids as identifiers since processMarkdownFiles uses MERGE
        return noteNodes.map((n) => n.oid);
      }

      // Default bulk creation for other node types
      const result = await tx.run(
        `UNWIND $nodes AS node
         CREATE (n:${label}) SET n = node
         RETURN id(n) as id`,
        { nodes },
      );

      const ids = result.records.map((r) => r.get('id').toString());
      await tx.commit();
      return ids;
    } catch (error) {
      await tx.rollback();
      console.error(`Error bulk creating ${label} nodes:`, error);
      throw error;
    } finally {
      await session.close();
    }
  }
}
