import { JanusGraphClient } from './janusGraphClient';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

interface TestConfig {
  host: string;
  port: number;
  username?: string;
  password?: string;
}

async function testConnection(client: JanusGraphClient): Promise<boolean> {
  try {
    await client.connect();
    console.log('✅ Connection test passed');
    return true;
  } catch (error) {
    console.error('❌ Connection test failed:', error);
    return false;
  } finally {
    await client.disconnect();
  }
}

async function testCRUDOperations(client: JanusGraphClient): Promise<void> {
  try {
    await client.connect();

    // Create vertex
    const createResult = await client.createVertex('test', {
      name: 'testVertex',
    });
    const vertexId = createResult.first().id;
    console.log(`✅ Created vertex with id: ${vertexId}`);

    // Get vertex
    const getResult = await client.getVertex(vertexId);
    console.log(`✅ Retrieved vertex:`, getResult.first());

    // Update vertex
    await client.updateVertex(vertexId, { name: 'updatedVertex' });
    console.log(`✅ Updated vertex`);

    // Create edge
    const vertex2 = await client.createVertex('test', { name: 'testVertex2' });
    const vertex2Id = vertex2.first().id;
    const edgeResult = await client.createEdge(vertexId, vertex2Id, 'testEdge');
    console.log(`✅ Created edge:`, edgeResult.first());

    // Delete vertex (will cascade delete edges)
    await client.deleteVertex(vertexId);
    console.log(`✅ Deleted vertex`);
  } catch (error) {
    console.error('❌ CRUD operations failed:', error);
    throw error;
  } finally {
    await client.disconnect();
  }
}

async function main() {
  const argv = await yargs(hideBin(process.argv))
    .option('host', {
      type: 'string',
      default: 'localhost',
      description: 'JanusGraph server host',
    })
    .option('port', {
      type: 'number',
      default: 8182,
      description: 'JanusGraph server port',
    })
    .option('username', {
      type: 'string',
      description: 'JanusGraph username',
    })
    .option('password', {
      type: 'string',
      description: 'JanusGraph password',
    }).argv;

  const config: TestConfig = {
    host: argv.host,
    port: argv.port,
    username: argv.username,
    password: argv.password,
  };

  console.log('Starting JanusGraph tests with config:', config);
  const client = new JanusGraphClient(config);

  try {
    // Test connection
    const connected = await testConnection(client);
    if (!connected) {
      process.exit(1);
    }

    // Test CRUD operations
    console.log('\nStarting CRUD operations test...');
    await testCRUDOperations(client);
    console.log('\n🎉 All tests passed successfully!');
  } catch (error) {
    console.error('Tests failed:', error);
    process.exit(1);
  }
}

main().catch(console.error);
