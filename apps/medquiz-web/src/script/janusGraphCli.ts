/**
 * JanusGraph CLI Tool
 *
 * A command-line interface for interacting with JanusGraph database.
 * Provides CRUD operations for vertices and edges.
 *
 * @module JanusGraphCLI
 * @example
 * // Create a vertex
 * npm run janusgraph -- create-vertex person --properties '{"name":"Alice"}'
 *
 * // Create an edge
 * npm run janusgraph -- create-edge 1 2 knows --properties '{"since":"2024"}'
 */
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { JanusGraphClient } from '@/lib/GraphRAG/janusGraphClient';

/**
 * Main function that handles CLI commands and executes JanusGraph operations
 *
 * @async
 * @function main
 * @throws {Error} When connection or query execution fails
 * @example
 * // Example usage in terminal:
 * // npm run janusgraph -- create-vertex person --properties '{"name":"John"}'
 */
async function main() {
  // Configure CLI options and commands
  const argv = await yargs(hideBin(process.argv))
    .option('host', {
      type: 'string',
      description: 'JanusGraph server hostname or IP address',
      default: 'localhost',
    })
    .option('port', {
      type: 'number',
      description: 'JanusGraph server port number',
      default: 8182,
    })
    .option('username', {
      type: 'string',
      description: 'Username for authenticated JanusGraph server',
    })
    .option('password', {
      type: 'string',
      description: 'Password for authenticated JanusGraph server',
    })
    .command('connect', 'Establish connection to JanusGraph server')
    .command('disconnect', 'Terminate connection from JanusGraph server')
    .command(
      'create-vertex <label>',
      'Create a new vertex with specified label and properties',
      (yargs) => {
        return yargs
          .positional('label', {
            type: 'string',
            description: 'Vertex label',
          })
          .option('properties', {
            type: 'string',
            description: 'Vertex properties as JSON string',
          });
      },
    )
    .command('get-vertex <id>', 'Get a vertex by ID', (yargs) => {
      return yargs.positional('id', {
        type: 'string',
        description: 'Vertex ID',
      });
    })
    .command('update-vertex <id>', 'Update a vertex', (yargs) => {
      return yargs
        .positional('id', {
          type: 'string',
          description: 'Vertex ID',
        })
        .option('properties', {
          type: 'string',
          description: 'Vertex properties as JSON string',
        });
    })
    .command('list-edges', 'List all edges in the graph', (yargs) => {
      return yargs;
    })
    .command('delete-all', 'Delete all vertices and edges from the graph')
    .command('delete-vertex <id>', 'Delete a vertex', (yargs) => {
      return yargs.positional('id', {
        type: 'string',
        description: 'Vertex ID',
      });
    })
    .command(
      'create-edge <from> <to> <label>',
      'Create an edge between two vertices',
      (yargs) => {
        return yargs
          .positional('from', {
            type: 'string',
            description: 'Source vertex ID',
          })
          .positional('to', {
            type: 'string',
            description: 'Target vertex ID',
          })
          .positional('label', {
            type: 'string',
            description: 'Edge label',
          })
          .option('properties', {
            type: 'string',
            description: 'Edge properties as JSON string',
          });
      },
    )
    .command('execute-query <query>', 'Execute a Gremlin query', (yargs) => {
      return yargs.positional('query', {
        type: 'string',
        description: 'The Gremlin query string to execute',
      });
    })
    .demandCommand(1, 'You need to specify a command')
    .help().argv;

  const client = new JanusGraphClient({
    host: argv.host,
    port: argv.port,
    username: argv.username,
    password: argv.password,
  });

  try {
    await client.connect();
    console.log('Connected to JanusGraph');

    const command = argv._[0];

    switch (command) {
      case 'connect':
        console.log('Already connected');
        break;

      case 'disconnect':
        await client.disconnect();
        console.log('Disconnected from JanusGraph');
        break;

      case 'create-vertex':
        const properties = argv.properties
          ? JSON.parse(argv.properties as string)
          : {};
        const vertex = await client.createVertex(
          argv.label as string,
          properties,
        );
        console.log('Created vertex:', vertex);
        break;

      case 'get-vertex':
        const vertexProps = await client.getVertex(argv.id as string);
        console.log('Vertex properties:', vertexProps);
        break;

      case 'update-vertex':
        const updateProps = argv.properties
          ? JSON.parse(argv.properties as string)
          : {};
        const updateResult = await client.updateVertex(
          argv.id as string,
          updateProps,
        );
        console.log('Updated vertex:', updateResult);
        break;

      case 'delete-vertex':
        await client.deleteVertex(argv.id as string);
        console.log('Deleted vertex:', argv.id);
        break;

      case 'create-edge':
        const edgeProps = argv.properties
          ? JSON.parse(argv.properties as string)
          : {};
        const edge = await client.createEdge(
          argv.from as string,
          argv.to as string,
          argv.label as string,
          edgeProps,
        );
        console.log('Created edge:', edge);
        break;

      case 'list-edges':
        const edges = await client.execute('g.E()');
        console.log('All edges:', edges);
        break;

      case 'delete-all':
        await client.execute('g.V().drop().iterate()');
        console.log('All JanusGraph content deleted');
        break;

      case 'execute-query':
        const query = argv.query as string;
        if (!query) {
          console.error('Error: Gremlin query is required.');
          process.exit(1);
        }
        console.log('Executing query:', query);
        const results = await client.execute(query);
        console.log('Query results:', results);
        break;

      default:
        console.error('Unknown command:', command);
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.disconnect();
  }
}

main().catch(console.error);
