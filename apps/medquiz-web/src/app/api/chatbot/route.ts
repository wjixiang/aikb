'use server';

require('dotenv').config(); // Explicitly load environment variables

import { NextRequest } from 'next/server';
import { ChatReq } from '@/lib/agents/agent.types';
import { AgentService } from '@/lib/services/agentService';
import { Agent } from '@/lib/agents/Agent';
import { language } from '@/kgrag/type';

// Remove edge runtime since we need Node.js APIs
// export const runtime = 'edge';

export async function POST(req: NextRequest) {
  try {
    const requestData: ChatReq = await req.json();
    console.log(`${JSON.stringify(requestData)}`);
    const agentConfig = {
      rag_config: requestData.rag_config,
    };

    // Use static config first
    const agent = new Agent(agentConfig);

    const agentService = new AgentService(agent, agentConfig);
    const agentStream = agentService.processRequest(requestData);
    const transformedStream = agentService.transformAgentStream(agentStream);

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        for await (const step of transformedStream) {
          const chunk = JSON.stringify(step) + '\n';
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Error in chatbot API:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );
  }
}
