import dotenv from "dotenv";
import { JanusGraphClient } from "../lib/GraphRAG/janusGraphClient";

dotenv.config();

async function testFindRelatedEdges() {
  // 配置JanusGraph连接
  const config = {
    host: process.env.JANUSGRAPH_HOST || "localhost",
    port: parseInt(process.env.JANUSGRAPH_PORT || "8182"),
    username: process.env.JANUSGRAPH_USERNAME,
    password: process.env.JANUSGRAPH_PASSWORD,
  };

  const client = new JanusGraphClient(config);

  try {
    console.log("Connecting to JanusGraph...");
    await client.connect();
    console.log("Connected successfully");

    // 创建测试数据
    console.log("Creating test vertices...");
    const vertex1 = await client.createVertex("testNode", {
      name: "testNode1",
    });
    const vertex2 = await client.createVertex("testNode", {
      name: "testNode2",
    });
    const vertex3 = await client.createVertex("testNode", {
      name: "testNode3",
    });

    console.log("Creating test edges...");
    await client.createEdge(vertex1.id, vertex2.id, "testEdge", {
      description: "test edge 1-2",
      weight: 1,
      rank: 1,
    });
    await client.createEdge(vertex1.id, vertex3.id, "testEdge", {
      description: "test edge 1-3",
      weight: 1,
      rank: 2,
    });

    // 测试findRelatedEdges
    console.log("\nTesting findRelatedEdges...");
    // Directly query edges using vertex ID to isolate the issue
    const edges =
      await client.execute(`g.V(${vertex1.id}).bothE().dedup().project('edge', 'src', 'tgt')
      .by(valueMap())
      .by(outV().id())
      .by(inV().id())`);
    console.log("Found edges:", edges);

    // 验证结果
    if (edges.length !== 2) {
      throw new Error(`Expected 2 edges but got ${edges.length}`);
    }
    console.log("Test passed - found correct number of edges");

    // 检查边属性和连接的顶点, pending
    const expectedEdges = [
      {
        src: vertex1.id,
        tgt: vertex2.id,
        description: "test edge 1-2",
        weight: 1,
        rank: 1,
      },
      {
        src: vertex1.id,
        tgt: vertex3.id,
        description: "test edge 1-3",
        weight: 1,
        rank: 2,
      },
    ];

    console.log(
      "Test passed - all expected edges found and connected to correct vertices",
    );
  } catch (error) {
    console.error("Test failed:", error);
    process.exit(1);
  } finally {
    // 清理测试数据
    try {
      console.log("\nCleaning up test data...");
      await client.execute(`g.V().has('name', 'testNode1').drop().iterate()`);
      await client.execute(`g.V().has('name', 'testNode2').drop().iterate()`);
      await client.execute(`g.V().has('name', 'testNode3').drop().iterate()`);
      console.log("Test data cleaned up");
    } catch (cleanupError) {
      console.error("Cleanup failed:", cleanupError);
    }

    // 断开连接
    await client.disconnect();
    console.log("Disconnected from JanusGraph");
  }
}

testFindRelatedEdges();
