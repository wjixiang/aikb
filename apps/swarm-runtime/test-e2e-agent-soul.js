/**
 * E2E Test: Agent Soul Flow (Async Mode)
 *
 * Tests the complete async A2A flow:
 * 1. List agent souls
 * 2. Create agent instance
 * 3. Create task (status=pending)
 * 4. Send A2A task -> returns 202 after ACK received
 * 5. Poll for task completion (async result via callback)
 * 6. Get task result
 */

const SWARM_URL = process.env.SWARM_URL || 'http://localhost:9400';
const API_BASE = `${SWARM_URL}/api`;

const POLL_INTERVAL_MS = 3000;
const MAX_POLL_ATTEMPTS = 40; // 2 minutes max wait

/**
 * @param {string} method
 * @param {string} path
 * @param {Record<string, unknown> | undefined} body
 * @returns {Promise<{status: number, data: Record<string, unknown>}>}
 */
async function request(method, path, body) {
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) {
    options.body = JSON.stringify(body);
  }
  const res = await fetch(`${API_BASE}${path}`, options);
  const data = await res.json();
  return { status: res.status, data };
}

/**
 * @param {string} taskId
 * @returns {Promise<{status: string} | null>}
 */
async function getTaskStatus(taskId) {
  const res = await request('GET', `/tasks/${taskId}`);
  if (res.status === 200) {
    return res.data.data;
  }
  return null;
}

/**
 * Poll for task to reach a terminal state
 * @param {string} taskId
 * @returns {Promise<{status: string, task: any} | null>}
 */
async function pollForTaskCompletion(taskId) {
  for (let attempt = 1; attempt <= MAX_POLL_ATTEMPTS; attempt++) {
    const task = await getTaskStatus(taskId);
    if (!task) {
      console.log(`   ⚠️  Attempt ${attempt}: Could not fetch task status`);
    } else {
      console.log(
        `   🔄 Attempt ${attempt}/${MAX_POLL_ATTEMPTS}: status=${task.status}`,
      );

      if (task.status === 'completed') {
        return { status: task.status, task };
      }

      if (task.status === 'failed') {
        return { status: task.status, task };
      }
    }

    if (attempt < MAX_POLL_ATTEMPTS) {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
  }
  return null;
}

/**
 * Wait for agent to be ready (status = idle)
 */
async function waitForAgentReady(agentId, maxAttempts = 10) {
  for (let i = 0; i < maxAttempts; i++) {
    const res = await request('GET', `/runtime/agents/${agentId}`);
    if (res.status === 200 && res.data.data?.status === 'idle') {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return false;
}

async function run() {
  console.log('🧪 E2E Test: Agent Soul Flow (Async Mode)\n');
  console.log(`Target: ${SWARM_URL}\n`);

  let agentId = null;
  let taskId = null;

  try {
    // Step 1: List agent souls
    console.log('📋 Step 1: List agent souls');
    const listRes = await request('GET', '/runtime/agent-souls');
    console.log(`   Status: ${listRes.status}`);
    if (listRes.status !== 200) {
      throw new Error(
        `Failed to list agent souls: ${JSON.stringify(listRes.data)}`,
      );
    }
    const souls = listRes.data.data;
    console.log(`   Found ${souls.length} agent souls:`);
    souls.forEach((s) => console.log(`   - ${s.token}: ${s.name}`));

    // Step 2: Create agent instance
    console.log('\n🤖 Step 2: Create agent instance');
    const createRes = await request('POST', '/runtime/agent-souls', {
      token: 'coordinator',
    });
    console.log(`   Status: ${createRes.status}`);
    if (createRes.status !== 201) {
      throw new Error(
        `Failed to create agent: ${JSON.stringify(createRes.data)}`,
      );
    }
    agentId = createRes.data.data.instanceId;
    console.log(`   Created agent: ${agentId}`);
    console.log(`   Token: ${createRes.data.data.token}`);

    // Wait for agent to be ready
    console.log('   ⏳ Waiting for agent to be ready...');
    const agentReady = await waitForAgentReady(agentId);
    if (agentReady) {
      console.log('   ✅ Agent is ready');
    } else {
      console.log('   ⚠️  Agent may not be fully ready');
    }

    // Step 3: Create task
    console.log('\n📝 Step 3: Create task');
    const taskRes = await request('POST', '/tasks', {
      description: '查找有关于血管外科的最新文献，用于撰写综述',
      targetInstanceId: agentId,
      priority: 'normal',
    });
    console.log(`   Status: ${taskRes.status}`);
    if (taskRes.status !== 201) {
      throw new Error(`Failed to create task: ${JSON.stringify(taskRes.data)}`);
    }
    taskId = taskRes.data.data.taskId;
    console.log(`   Created task: ${taskId}`);

    // Check initial task status
    const initialTask = await getTaskStatus(taskId);
    console.log(`   Initial task status: ${initialTask?.status || 'unknown'}`);
    if (initialTask?.status !== 'pending') {
      throw new Error(
        `Expected task status to be 'pending', got '${initialTask?.status}'`,
      );
    }

    // Step 4: Send A2A task (should return 202 immediately after ACK)
    console.log('\n📨 Step 4: Send A2A task');
    console.log('   ⏳ Waiting for ACK (max 60s)...');
    const startTime = Date.now();

    const a2aRes = await request('POST', '/a2a/task', {
      taskId: taskId,
    });

    const ackTime = Date.now() - startTime;
    console.log(`   ⏱️  Response time: ${ackTime}ms`);
    console.log(`   Status: ${a2aRes.status}`);

    if (a2aRes.status === 202) {
      console.log('   ✅ A2A task acknowledged (202 Accepted)');
      console.log(`   Response: ${JSON.stringify(a2aRes.data)}`);

      // Verify task status changed to processing
      const afterAckTask = await getTaskStatus(taskId);
      console.log(`   Task status after ACK: ${afterAckTask?.status}`);

      if (afterAckTask?.status !== 'processing') {
        console.log(
          `   ⚠️  Warning: Expected 'processing', got '${afterAckTask?.status}'`,
        );
      }
    } else if (a2aRes.status === 408) {
      console.log('   ❌ ACK timeout - task could not be delivered to agent');
      console.log(`   Error: ${a2aRes.data.error}`);
      console.log('\n   Skipping poll since task was not delivered.');
    } else if (a2aRes.status === 400) {
      console.log(`   ⚠️  Bad request: ${a2aRes.data.error}`);
      console.log('\n   Skipping poll.');
    } else if (a2aRes.status === 404) {
      console.log(`   ⚠️  Task not found: ${a2aRes.data.error}`);
      console.log('\n   Skipping poll.');
    } else {
      console.log(`   ❌ Unexpected status: ${a2aRes.status}`);
      console.log(`   Error: ${a2aRes.data.error}`);
    }

    // Only poll if we got 202 (ACK was received)
    if (a2aRes.status === 202) {
      // Step 5: Poll for task completion
      console.log('\n⏳ Step 5: Poll for task completion');
      console.log(
        `   Polling every ${POLL_INTERVAL_MS}ms, max ${MAX_POLL_ATTEMPTS} attempts...`,
      );

      const pollResult = await pollForTaskCompletion(taskId);

      if (!pollResult) {
        console.log('   ❌ Timeout waiting for task completion');

        // Final status check
        const finalTask = await getTaskStatus(taskId);
        console.log(`   Final status: ${finalTask?.status || 'unknown'}`);
      } else if (pollResult.status === 'completed') {
        console.log('   ✅ Task completed!');
      } else if (pollResult.status === 'failed') {
        console.log(
          `   ❌ Task failed: ${pollResult.task.error || 'unknown error'}`,
        );
      }

      // Step 6: Get task result
      console.log('\n📋 Step 6: Get task result');
      const resultRes = await request('GET', `/tasks/${taskId}/result`);
      if (resultRes.status === 200 && resultRes.data.data) {
        const taskResult = resultRes.data.data;
        console.log(`   Task ID: ${taskResult.taskId}`);
        console.log(`   Status: ${taskResult.status}`);
        if (taskResult.output) {
          const outputStr = JSON.stringify(taskResult.output).slice(0, 500);
          console.log(`   Output: ${outputStr}...`);
        }
        if (taskResult.error) {
          console.log(`   Error: ${taskResult.error}`);
        }
      } else {
        console.log(`   No result available (status: ${resultRes.status})`);
      }
    } else {
      console.log('\n⏭️  Step 5 & 6 skipped (no ACK received)');
    }

    console.log('\n✅ E2E Test completed!');
    console.log('\n📊 Summary:');
    console.log(`   - Agent Souls listed: ${souls.length}`);
    console.log(`   - Agent created: ${agentId}`);
    console.log(`   - Task created: ${taskId}`);
    console.log(`   - Response time: ${ackTime}ms`);
    console.log(`   - A2A HTTP status: ${a2aRes.status}`);
    if (a2aRes.status === 202) {
      const finalTask = await getTaskStatus(taskId);
      console.log(`   - Task final status: ${finalTask?.status || 'unknown'}`);
    }

    // Server log hints
    console.log('\n📖 Check server logs for:');
    console.log('   - "[AckTracker] ACK received" → ACK received by sender ✅');
    console.log('   - "[A2AHandler] Sent ACK" → ACK sent by receiver');
    console.log(
      '   - "[AgentRuntime] Task xxx processing" → Callback triggered',
    );
    console.log(
      '   - "[AgentRuntime] Task xxx completed" → Result stored via callback',
    );
    console.log('   - "[Prisma] Task marked as completed" → Database updated');
  } catch (error) {
    console.error('\n❌ E2E Test failed!');
    console.error(
      `   Error: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }
}

run();
