#!/usr/bin/env node

/**
 * A simple MCP echo server that repeats back whatever it is prompted for testing.
 * It implements a single tool that echoes back the input message.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

/**
 * Create an MCP server with capabilities for tools (to echo messages).
 */
const server = new Server(
  {
    name: 'echo-server',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

/**
 * Handler that lists available tools.
 * Exposes a single "echo" tool that echoes back the input message.
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'echo',
        description: 'Echoes back the input message',
        inputSchema: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              description: 'The message to echo back',
            },
          },
          required: ['message'],
        },
      },
    ],
  };
});

/**
 * Handler for the echo tool.
 * Simply returns the input message.
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  switch (request.params.name) {
    case 'echo': {
      const message = String(request.params.arguments?.message || '');

      if (!message) {
        return {
          content: [
            {
              type: 'text',
              text: "You didn't provide a message to echo!",
            },
          ],
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: message,
          },
        ],
      };
    }

    default:
      throw new Error('Unknown tool');
  }
});

/**
 * Start the server using stdio transport.
 * This allows the server to communicate via standard input/output streams.
 */
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Echo MCP server running on stdio');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
