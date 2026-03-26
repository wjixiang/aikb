#!/usr/bin/env node

/**
 * Swarm Client Example
 *
 * 演示如何使用 HTTP API 与 Swarm 服务器交互
 */

import { createAgentRuntime } from 'agent-lib/core';

// 服务器配置
const SERVER_URL = process.env['SWARM_SERVER_URL'] || 'http://localhost:9400';

// ============================================================
// Helper Functions
// ============================================================

async function get(path: string) {
  const response = await fetch(`${SERVER_URL}${path}`);
  if (!response.ok) {
    throw new Error(`GET ${path} failed: ${response.statusText}`);
  }
  return response.json();
}

async function post(path: string, body: unknown) {
  const response = await fetch(`${SERVER_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`POST ${path} failed: ${response.statusText}`);
  }
  return response.json();
}

async function del(path: string) {
  const response = await fetch(`${SERVER_URL}${path}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error(`DELETE ${path} failed: ${response.statusText}`);
  }
  return response.json();
}

// ============================================================
// Main Example
// ============================================================

async function main() {
  console.log('========================================');
  console.log('Swarm Client Example');
  console.log('========================================');
  console.log(`Server: ${SERVER_URL}`);
  console.log('');

  // 1. Health Check
  console.log('1. Health Check');
  const health = await get('/health');
  console.log(`   Status: ${health.status}`);
  console.log(`   Server ID: ${health.serverId}`);
  console.log('');

  // 2. Get Runtime Stats
  console.log('2. Runtime Stats');
  const stats = await get('/api/runtime/stats');
  console.log(`   Total Agents: ${stats.data.totalAgents}`);
  console.log('');

  // 3. Create Epidemiology Agent
  console.log('3. Create Epidemiology Agent');
  const agentResponse = await post('/api/runtime/agents', {
    agent: {
      name: 'Epidemiology Search',
      type: 'epidemiology',
      description: 'Search for epidemiology literature',
    },
  });
  console.log(`   Agent ID: ${agentResponse.data.instanceId}`);
  console.log('');

  const agentId = agentResponse.data.instanceId;

  // 4. Get Agent Details
  console.log('4. Get Agent Details');
  const agentDetails = await get(`/api/agents/${agentId}`);
  console.log(`   Name: ${agentDetails.data.name}`);
  console.log(`   Status: ${agentDetails.data.status}`);
  console.log('');

  // 5. Send A2A Query
  console.log('5. Send A2A Query');
  try {
    const queryResponse = await post('/api/a2a/query', {
      targetAgentId: agentId,
      query: 'What is your current status?',
    });
    console.log(`   Response: ${JSON.stringify(queryResponse.data).substring(0, 100)}...`);
  } catch (error) {
    console.log(`   Query failed (agent may not be started yet)`);
  }
  console.log('');

  // 6. List All Agents
  console.log('6. List All Agents');
  const agents = await get('/api/runtime/agents');
  console.log(`   Count: ${agents.count}`);
  agents.data.forEach((agent: any) => {
    console.log(`   - ${agent.instanceId} (${agent.status})`);
  });
  console.log('');

  // 7. Cleanup - Destroy Agent
  console.log('7. Destroy Agent');
  await del(`/api/agents/${agentId}`);
  console.log(`   Agent destroyed`);
  console.log('');

  console.log('========================================');
  console.log('Example Complete!');
  console.log('========================================');
}

// Run example
main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
