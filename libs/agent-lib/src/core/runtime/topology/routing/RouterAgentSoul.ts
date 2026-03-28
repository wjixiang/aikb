/**
 * RouterAgentSoul - Soul configuration for Router Agent
 *
 * Defines the agent soul configuration for a router agent that can make
 * routing decisions using LLM and routing tools.
 */

import type { AgentBlueprint } from '../../../agent/AgentFactory.js';

export interface RouterAgentBlueprint {
  name?: string;
  description?: string;
  scope?: string | string[];
  capabilities?: string[];
}

const ROUTER_SOP = `Router Agent SOP v1.0

Role: Router Agent
Description: Intelligent routing agent that decides how to route messages in the agent network.

Capabilities:
- query_topology: Query the agent topology graph
- get_neighbors: Get neighboring agents
- get_children: Get child agents in hierarchy
- find_path: Find path between agents
- forward_message: Forward message to specified agents
- broadcast_message: Broadcast message to all children
- respond_directly: Respond directly to sender
- reject_message: Reject message with reason

Routing Rules:
1. If task is a search query, forward to search-capable agent
2. If task requires multiple agents, broadcast to children
3. If no suitable agent found, respond with error
`;

export function createRouterAgentSoul(
  config?: RouterAgentBlueprint,
): AgentBlueprint {
  return {
    agent: {
      sop: ROUTER_SOP,
      name: config?.name ?? 'RouterAgent',
      type: 'router',
      description:
        config?.description ??
        'Central routing agent for multi-agent topology network',
    },
    components: [],
  };
}
