import createLoggerWithPrefix from '@aikb/log-management/logger';
import { connectToDatabase } from '../../libs/utils/mongodb';
import { AbstractEntityGraphStorage } from './abstract-storage';

/**
 * Concrete implementation of EntityGraphStorage using MongoDB
 */
class MongoEntityGraphStorage extends AbstractEntityGraphStorage {
  private collectionName = 'relationships';

  logger = createLoggerWithPrefix('MongoEntityGraphStorage');

  async create_relation(
    sourceId: string,
    targetId: string,
    relationType: string,
    properties?: Record<string, any>,
  ): Promise<void> {
    try {
      const { db } = await connectToDatabase();
      const collection = db.collection(this.collectionName);

      const relation = {
        sourceId,
        targetId,
        relationType,
        properties: properties || {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await collection.insertOne(relation);
      this.logger.info(
        `Created relation with _id: ${JSON.stringify(result.insertedId)} from ${sourceId} to ${targetId} with type ${relationType}`,
      );
    } catch (error) {
      this.logger.error('Failed to create relation:', error);
      throw error;
    }
  }

  async get_entity_relations(
    entityId: string,
    relationType?: string,
  ): Promise<
    Array<{
      sourceId: string;
      targetId: string;
      relationType: string;
      properties?: Record<string, any>;
    }>
  > {
    try {
      const { db } = await connectToDatabase();
      const collection = db.collection(this.collectionName);

      const query: any = {
        $or: [{ sourceId: entityId }, { targetId: entityId }],
      };

      if (relationType) {
        query.relationType = relationType;
      }

      const relations = await collection.find(query).toArray();

      // Remove MongoDB-specific _id field before returning
      const result = relations.map(
        ({ _id, ...relation }) =>
          relation as {
            sourceId: string;
            targetId: string;
            relationType: string;
            properties?: Record<string, any>;
          },
      );
      this.logger.info(
        `Found ${result.length} relations for entity ${entityId}`,
      );
      return result;
    } catch (error) {
      this.logger.error('Failed to get entity relations:', error);
      throw error;
    }
  }

  async update_relation(
    sourceId: string,
    targetId: string,
    relationType: string,
    properties: Record<string, any>,
  ): Promise<void> {
    try {
      const { db } = await connectToDatabase();
      const collection = db.collection(this.collectionName);

      const updateResult = await collection.updateOne(
        {
          sourceId,
          targetId,
          relationType,
        },
        {
          $set: {
            properties,
            updatedAt: new Date(),
          },
        },
      );

      if (updateResult.modifiedCount === 0) {
        throw new Error(
          `Relation from ${sourceId} to ${targetId} with type ${relationType} not found`,
        );
      }

      this.logger.info(
        `Updated relation from ${sourceId} to ${targetId} with type ${relationType}`,
      );
    } catch (error) {
      this.logger.error('Failed to update relation:', error);
      throw error;
    }
  }

  async delete_relation(
    sourceId: string,
    targetId: string,
    relationType: string,
  ): Promise<boolean> {
    try {
      const { db } = await connectToDatabase();
      const collection = db.collection(this.collectionName);

      const deleteResult = await collection.deleteOne({
        sourceId,
        targetId,
        relationType,
      });

      if (deleteResult.deletedCount === 0) {
        this.logger.warn(
          `Relation from ${sourceId} to ${targetId} with type ${relationType} not found for deletion`,
        );
        return false;
      }

      this.logger.info(
        `Deleted relation from ${sourceId} to ${targetId} with type ${relationType}`,
      );
      return true;
    } catch (error) {
      this.logger.error('Failed to delete relation:', error);
      throw error;
    }
  }

  async find_paths(
    sourceId: string,
    targetId: string,
    maxDepth: number = 3,
  ): Promise<
    Array<
      Array<{
        entityId: string;
        relationType: string;
      }>
    >
  > {
    try {
      const { db } = await connectToDatabase();
      const collection = db.collection(this.collectionName);

      console.log(
        `[DEBUG] Starting path finding from ${sourceId} to ${targetId} with max depth ${maxDepth}`,
      );

      const paths: Array<
        Array<{
          entityId: string;
          relationType: string;
        }>
      > = [];

      // Use iterative BFS to avoid recursion depth issues
      const queue: Array<{
        currentId: string;
        path: Array<{
          entityId: string;
          relationType: string;
        }>;
        visited: Set<string>;
      }> = [
        {
          currentId: sourceId,
          path: [],
          visited: new Set([sourceId]),
        },
      ];

      while (queue.length > 0) {
        const { currentId, path, visited } = queue.shift()!;

        console.log(
          `[DEBUG] Processing node: ${currentId}, path length: ${path.length}`,
        );

        // If we've reached the target, add this path to results
        if (currentId === targetId) {
          console.log(`[DEBUG] Found target! Path: ${JSON.stringify(path)}`);
          paths.push([...path]);
          continue;
        }

        // If we've reached max depth, skip this path
        // Note: path.length represents the number of hops so far
        // When path.length is 0, we're at the source node with 0 hops
        // When path.length is 1, we've made 1 hop, etc.
        if (path.length >= maxDepth) {
          console.log(
            `[DEBUG] Max depth reached for path: ${JSON.stringify(path)}`,
          );
          continue;
        }

        // Find all outgoing relations from currentId
        const outgoingRelations = await collection
          .find({
            sourceId: currentId,
          })
          .toArray();

        console.log(
          `[DEBUG] Found ${outgoingRelations.length} outgoing relations from ${currentId}`,
        );

        // Only consider outgoing relations for path finding
        // This ensures we follow the direction of relationships
        for (const relation of outgoingRelations) {
          const nextId = relation.targetId;

          // Skip if we've already visited this node in this path
          if (visited.has(nextId)) {
            continue;
          }

          // Check if we're at the target node
          if (nextId === targetId) {
            // Add the complete path including the target
            paths.push([
              ...path,
              {
                entityId: nextId,
                relationType: relation.relationType,
              },
            ]);
            continue;
          }

          // If we haven't reached max depth yet, continue exploring
          if (path.length < maxDepth) {
            const newPath = [
              ...path,
              {
                entityId: nextId,
                relationType: relation.relationType,
              },
            ];

            const newVisited = new Set(visited);
            newVisited.add(nextId);

            queue.push({
              currentId: nextId,
              path: newPath,
              visited: newVisited,
            });
          }
        }
      }

      this.logger.info(
        `Found ${paths.length} paths from ${sourceId} to ${targetId} with max depth ${maxDepth}`,
      );
      return paths;
    } catch (error) {
      this.logger.error('Failed to find paths:', error);
      throw error;
    }
  }
}

export { MongoEntityGraphStorage };
