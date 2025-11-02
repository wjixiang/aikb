#!usr/bin/env ts-node

import { JanusGraphClient } from "../lib/GraphRAG/janusGraphClient";

// Test configuration - adjust as needed
const TEST_CONFIG = {
  host: "localhost",
  port: 8182,
};

// Helper function to build properties string
function buildProperties(properties: Record<string, any>): string {
  return Object.entries(properties)
    .map(([key, value]) => `.property('${key}', ${JSON.stringify(value)})`)
    .join("");
}

// Test node data - using numeric IDs
const TEST_NODE_ID = 1001;
const TEST_NODE_NAME = "test_node_1";
const TEST_NODE_DATA = { name: TEST_NODE_NAME, type: "test" };

async function main() {
  console.log("Starting node_degree test...");

  // Initialize client
  const client = new JanusGraphClient(TEST_CONFIG);

  try {
    // Connect to JanusGraph
    await client.connect();
    console.log("Connected to JanusGraph server");

    // Clean up previous test data if it exists
    console.log("Cleaning up previous test data...");
    try {
      await client.deleteVertex(TEST_NODE_NAME);
      // Also attempt to delete potential target nodes from previous runs
      for (let i = 2; i <= 5; i++) {
        // Check a few potential target node names
        await client.deleteVertex(`test_node_${i}`);
      }
      console.log("Previous test data cleaned up.");
    } catch (error) {
      console.log(
        "No previous test data found or error during cleanup:",
        error,
      );
    }

    // Create test node
    console.log(`Creating test node ${TEST_NODE_NAME}`);
    await client.createVertex("test_node", {
      id: TEST_NODE_ID,
      ...TEST_NODE_DATA,
    });

    // Test 1: Get degree of isolated node (should be 0)
    console.log("\nTest 1: Degree of isolated node");
    const initialDegree = await client.nodeDegree(TEST_NODE_NAME);
    console.log(`Node ${TEST_NODE_NAME} degree:`, initialDegree);
    if (initialDegree !== 0) {
      console.warn("Warning: Expected degree 0 for isolated node");
    }

    // Test 2: Create edges and check degree
    console.log("\nTest 2: Degree after adding edges");

    // Create some edges
    const edgeCount = 3;
    for (let i = 1; i <= edgeCount; i++) {
      const targetName = `test_node_${i + 1}`;
      // Create target node if it doesn't exist
      const hasTargetNode = await client.has_node(targetName);
      if (!hasTargetNode) {
        await client.createVertex("test_node", { name: targetName });
      }
      await client.createEdge(TEST_NODE_NAME, targetName, "connected");
      console.log(`Created edge to ${targetName}`);

      // Verify edge exists
      const hasEdge = await client.has_edge(TEST_NODE_NAME, targetName);
      if (!hasEdge) {
        console.warn(
          `Warning: Edge between ${TEST_NODE_NAME} and ${targetName} not found`,
        );
      }

      // Check degree after each edge
      const currentDegree = await client.nodeDegree(TEST_NODE_NAME);
      console.log(`Current degree:`, currentDegree);

      if (currentDegree !== i) {
        console.warn(`Warning: Expected degree ${i}, got ${currentDegree}`);
      }
    }

    // Test 3: Remove edges and check degree
    console.log("\nTest 3: Degree after removing edges");
    for (let i = edgeCount; i > 0; i--) {
      const targetName = `test_node_${i + 1}`;
      await client.deleteVertex(targetName);

      // Check degree after each removal
      const currentDegree = await client.nodeDegree(TEST_NODE_NAME);
      console.log(`After removing ${targetName}, degree:`, currentDegree);

      if (currentDegree !== i - 1) {
        console.warn(`Warning: Expected degree ${i - 1}, got ${currentDegree}`);
      }
    }

    // Clean up
    console.log("\nCleaning up test data...");
    await client.deleteVertex(TEST_NODE_NAME);

    console.log("\nAll tests completed!");
  } catch (error) {
    console.error("Test failed:", error);
  } finally {
    await client.disconnect();
  }
}

main().catch(console.error);
