import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { embeddings } from "@/lib/langchain/provider";
import milvusCollectionOperator from "@/lib/milvus/milvusCollectionOperator";
import {
  DataType,
  FieldType,
  IndexState,
  FunctionType,
} from "@zilliz/milvus2-sdk-node";

async function addBm25Field(collectionName: string) {
  const operator = new milvusCollectionOperator(collectionName);

  try {
    // 1. Get schema from existing collection
    const describeRes = await operator.milvusClient.describeCollection({
      collection_name: collectionName,
      timeout: 300, // 300 seconds timeout
    });

    // 2. Create a new collection with all original fields plus BM25
    const newCollectionName = `${collectionName}_with_bm25`;
    console.log(
      `Creating new collection ${newCollectionName} with BM25 field...`,
    );

    // Get embedding dimension from existing collection
    const dim = await operator.checkEmbeddingDimension();

    // Build fields array including all original fields
    const fields: FieldType[] = describeRes.schema.fields.map((field) => {
      const newField: FieldType = {
        name: field.name,
        description: field.description,
        data_type: field.dataType,
        is_primary_key: field.is_primary_key,
        is_partition_key: field.is_partition_key,
        element_type: field.element_type,
        autoID: false,
        type_params: field.type_params
          ? Object.fromEntries(
              field.type_params.map((tp) => [tp.key, tp.value]),
            )
          : {},
      };

      // Enable analyzer for text field
      if (field.dataType === DataType.VarChar) {
        newField["enable_analyzer"] = true;
      }

      return newField;
    });

    // Add BM25 field with proper type definition
    fields.push({
      name: "bm25_vector",
      description: "BM25 vector field",
      data_type: DataType.SparseFloatVector,
      enable_analyzer: true,
    });

    // Define BM25 function
    const functions = [
      {
        name: "text_bm25_emb",
        description: "BM25 function",
        type: FunctionType.BM25,
        input_field_names: ["content"],
        output_field_names: ["bm25_vector"],
        params: {},
      },
    ];

    await operator.milvusClient.createCollection({
      collection_name: newCollectionName,
      fields,
      functions,
    });

    // 3. Check and create indexes for all fields
    const schema = await operator.milvusClient.describeCollection({
      collection_name: newCollectionName,
    });

    const schemaFields = schema.schema.fields;

    for (const field of schemaFields) {
      const fieldName = field.name;
      console.log(`Checking index for field: ${fieldName}`);

      const indexes = await operator.milvusClient.listIndexes({
        collection_name: newCollectionName,
      });

      let indexExists = false;
      for (const indexName of indexes.indexes) {
        const index = await operator.milvusClient.describeIndex({
          collection_name: newCollectionName,
          index_name: indexName,
        });
        if (index.index_descriptions[0].field_name === fieldName) {
          indexExists = true;
          break;
        }
      }

      if (!indexExists) {
        console.log(
          `Index does not exist for field: ${fieldName}. Creating index...`,
        );

        let indexType = "";
        let metricType = "";
        let params = {};

        if (
          field.data_type === DataType[DataType.FloatVector] ||
          field.data_type === DataType[DataType.BinaryVector]
        ) {
          indexType = "HNSW";
          metricType = "COSINE";
          params = { M: "8", efConstruction: "64" };
        } else if (field.data_type === DataType[DataType.SparseFloatVector]) {
          indexType = "SPARSE_INVERTED_INDEX";
          metricType = "BM25";
          params = {
            inverted_index_algo: "DAAT_WAND",
            drop_ratio_build: "0.2",
          };
        } else {
          indexType = "INVERTED";
        }

        console.log(
          `Creating index for field: ${fieldName} with type: ${indexType}, metric: ${metricType}`,
        );
        const createRes = await operator.milvusClient.createIndex({
          collection_name: newCollectionName,
          field_name: fieldName,
          index_type: indexType,
          metric_type: metricType,
          params: params,
        });
        console.log(`Index creation response:`, createRes);

        console.log(
          `Index created for field: ${fieldName}, waiting for build to complete...`,
        );

        // Wait for index to be built with timeout
        const startTime = Date.now();
        const timeoutMs = 120000; // 120 seconds timeout for sparse index
        let indexState: string = "";

        while (true) {
          const stateRes = await operator.milvusClient.getIndexState({
            collection_name: newCollectionName,
            index_name: fieldName,
          });
          indexState = String(stateRes.state);

          if (indexState === "Finished") {
            console.log(`Index built successfully for field: ${fieldName}`);
            break;
          }

          if (indexState === "Failed") {
            try {
              const stateRes = await operator.milvusClient.describeIndex({
                collection_name: newCollectionName,
                index_name: fieldName,
              });
              const failReason =
                stateRes.index_descriptions[0]?.index_state_fail_reason ||
                "Unknown";
              console.error(`Index build failed details:`, stateRes);
              throw new Error(
                `Index build failed for field: ${fieldName}. Reason: ${failReason}`,
              );
            } catch (err) {
              throw new Error(
                `Index build failed for field: ${fieldName} and failed to get failure details: ${err}`,
              );
            }
          }

          if (Date.now() - startTime > timeoutMs) {
            throw new Error(
              `Index build timed out (${timeoutMs / 1000}s) for field: ${fieldName}`,
            );
          }

          const elapsedSec = Math.floor((Date.now() - startTime) / 1000);
          if (elapsedSec % 5 === 0) {
            // Log every 5 seconds
            console.log(
              `Waiting for index to build (${elapsedSec}s elapsed, current state: ${indexState})...`,
            );
            // Additional debug: check collection loading state
            try {
              const loadState = await operator.milvusClient.getLoadState({
                collection_name: newCollectionName,
              });
              console.log(`Collection load state: ${loadState.state}`);
            } catch (err) {
              console.log(`Error checking load state: ${err}`);
            }
          }
          await new Promise((resolve) => setTimeout(resolve, 1000));
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      } else {
        console.log(`Index already exists for field: ${fieldName}`);
      }
    }

    console.log("All indexes are built.");

    // 5. Load collection
    await operator.milvusClient.loadCollectionSync({
      collection_name: newCollectionName,
      timeout: 300, // Increase timeout for loading the new collection
    });

    console.log(
      `Successfully created collection ${newCollectionName} with BM25 field`,
    );

    // 6. Migrate data from old collection
    console.log(
      `Starting data migration from ${collectionName} to ${newCollectionName}...`,
    );
    await migrateData(operator, collectionName, newCollectionName);

    console.log(
      `✅ Successfully added BM25 field and migrated data to ${newCollectionName}`,
    );
  } catch (error) {
    console.error(`❌ Error adding BM25 field: ${error}`);
    process.exit(1);
  }
}

async function migrateData(
  operator: milvusCollectionOperator,
  source: string,
  target: string,
) {
  try {
    console.log(`Starting data migration from ${source} to ${target}...`);

    // Log target collection schema
    const targetSchema = await operator.milvusClient.describeCollection({
      collection_name: target,
      timeout: 300,
    });
    console.log(
      `Target collection ('${target}') schema fields:`,
      targetSchema.schema.fields.map((f) => f.name),
    );

    // First ensure source collection is loaded
    await operator.milvusClient.loadCollectionSync({
      collection_name: source,
      timeout: 300, // 300 seconds timeout
    });

    // Get total count of documents
    const countRes = await operator.milvusClient.count({
      collection_name: source,
    });
    const total = countRes.data;
    console.log(`Found ${total} documents to migrate`);

    if (total === 0) {
      console.log("No documents found to migrate");
      return;
    }

    // Process in smaller batches with retries
    const batchSize = 100;
    let offset = 0;
    let migrated = 0;
    const maxRetries = 3;

    while (offset < total) {
      let retryCount = 0;
      let success = false;
      let documents = [];

      // Query with retries
      while (retryCount < maxRetries && !success) {
        try {
          // Explicitly list needed fields instead of '*'
          const neededFields = [
            "oid",
            "title",
            "alias",
            "content",
            "tags",
            "embedding",
            "partition_key",
          ];
          const queryRes = await operator.milvusClient.query({
            collection_name: source,
            output_fields: neededFields,
            expr: 'oid != ""',
            limit: batchSize,
            offset: offset,
            timeout: 3000,
          });

          if (!queryRes.data || queryRes.data.length === 0) {
            break;
          }

          documents = queryRes.data.map((doc) => {
            // Only include fields that exist in target collection, ensuring correct types
            // Omit bm25_vector as the function should generate it
            const newDoc: any = {
              oid: String(doc.oid || ""), // Ensure string
              title: String(doc.title || ""), // Ensure string
              content: String(doc.content || ""), // Ensure string
            };

            // Alias: Expects VarChar (string). Join if array, else use empty string.
            if (doc.alias && Array.isArray(doc.alias)) {
              newDoc.alias = doc.alias.join(", ");
            } else if (doc.alias) {
              newDoc.alias = String(doc.alias);
            } else {
              newDoc.alias = "";
            }

            // Tags: Expects Array of VarChar (string[]). Ensure elements are strings.
            if (doc.tags && Array.isArray(doc.tags)) {
              // Filter out any potentially null/undefined tags before mapping
              newDoc.tags = doc.tags
                .filter((tag) => tag != null)
                .map((tag) => String(tag));
            } else {
              newDoc.tags = [];
            }

            // Embedding: Ensure it's an array of numbers (floats)
            if (doc.embedding && Array.isArray(doc.embedding)) {
              // Filter out non-numeric values and ensure they are numbers
              newDoc.embedding = doc.embedding
                .filter((val) => typeof val === "number" && !isNaN(val))
                .map(Number);
            } else {
              // Handle case where embedding is missing or not an array - depends on schema nullability
              // Assuming nullable for now, omitting if invalid. Check your schema.
              // newDoc.embedding = []; // Or handle as error if required
            }

            // Partition Key: Ensure string
            if (doc.partition_key) {
              newDoc.partition_key = String(doc.partition_key);
            } else {
              // Handle missing partition key based on schema (nullable?)
              // Assuming nullable for now. Check your schema.
              // newDoc.partition_key = ""; // Or handle as error if required
            }

            return newDoc;
          });
          success = true;
        } catch (error: any) {
          retryCount++;
          console.error(
            `Query attempt ${retryCount} failed: ${error.message}, retrying...`,
          );
          if (retryCount >= maxRetries) throw error;
          await new Promise((resolve) =>
            setTimeout(resolve, 1000 * retryCount),
          );
        }
      }

      if (!documents || documents.length === 0) {
        console.log("No documents fetched in this batch, skipping insert.");
        offset += batchSize; // Ensure loop progresses even if query returns empty
        continue;
      }

      // Log keys of the first document in the batch
      console.log(
        `Attempting to insert batch starting at offset ${offset}. First document keys:`,
        Object.keys(documents[0]),
      );

      // Log types and sample values of the first document before attempting insert
      const firstDoc = documents[0];
      console.log("First document details before insert:");
      for (const key in firstDoc) {
        const value = firstDoc[key];
        const type = typeof value;
        let sampleValue = value;
        if (Array.isArray(value)) {
          sampleValue = `Array[${value.length}]`;
        } else if (type === "object" && value !== null) {
          sampleValue = JSON.stringify(value).substring(0, 50) + "..."; // Show partial object
        } else if (type === "string") {
          sampleValue = `"${value.substring(0, 50)}${value.length > 50 ? "..." : ""}"`;
        }
        console.log(`  - ${key}: type=${type}, value=${sampleValue}`);
      }

      // Insert with retries
      retryCount = 0;
      success = false;
      while (retryCount < maxRetries && !success) {
        try {
          const insertRes = await operator.milvusClient.insert({
            collection_name: target,
            data: documents,
            timeout: 300,
          });

          if (insertRes.status.error_code !== "Success") {
            // Correctly log the failing document object
            console.error(
              "Failing document data (first doc in batch):",
              JSON.stringify(firstDoc, null, 2),
            );
            throw new Error(`Batch insert failed: ${insertRes.status.reason}`);
          }
          success = true;
        } catch (error: any) {
          retryCount++;
          console.error(
            `Insert attempt ${retryCount} failed: ${error.message}, retrying...`,
          );
          if (retryCount >= maxRetries) {
            // Correctly log the failing document object on final failure
            console.error(
              "Max insert retries reached. Failing document data (first doc in batch):",
              JSON.stringify(firstDoc, null, 2),
            );
            throw error; // Re-throw after logging
          }
          await new Promise((resolve) =>
            setTimeout(resolve, 1000 * retryCount),
          );
        }
      }

      migrated += documents.length;
      offset += batchSize;
      const progressPercent = Math.round((migrated / total) * 100);
      console.log(
        `Migrated ${migrated}/${total} documents (${progressPercent}%)`,
      );
    }

    console.log(`✅ Successfully migrated ${migrated} documents`);
  } catch (error) {
    console.error(`❌ Migration failed: ${error}`);
    throw error;
  }
}

// CLI setup
// eslint-disable-next-line @typescript-eslint/no-unused-expressions
yargs(hideBin(process.argv))
  .command(
    "add-bm25",
    "Add BM25 field to a Milvus collection",
    (yargs) => {
      return yargs.option("collection", {
        alias: "c",
        type: "string",
        description: "Collection name to add BM25 field to",
        demandOption: true,
      });
    },
    async (argv) => {
      await addBm25Field(argv.collection);
    },
  )
  .demandCommand(1, "You need at least one command")
  .strict()
  .help().argv;
