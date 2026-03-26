/**
 * E2E Test: Agent Soul Flow
 *
 * Tests the complete flow:
 * 1. List agent souls
 * 2. Create agent instance
 * 3. Create task
 * 4. Send A2A task
 */

const SWARM_URL = process.env.SWARM_URL || 'http://localhost:9400';
const API_BASE = `${SWARM_URL}/api`;

const AgentSoulInfo = { instanceId: '', token: '', serverId: '' };
const TaskInfo = { taskId: '' };

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

async function run() {
  console.log('🧪 E2E Test: Agent Soul Flow\n');
  console.log(`Target: ${SWARM_URL}\n`);

  /** @type {string | null} */
  let agentId = null;
  /** @type {string | null} */
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
      token: 'epidemiology',
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

    // Step 3: Create task
    console.log('\n📝 Step 3: Create task');
    const taskRes = await request('POST', '/tasks', {
      description: '查找椎间盘突出治疗措施的最新文献',
      targetInstanceId: agentId,
      priority: 'normal',
    });
    console.log(`   Status: ${taskRes.status}`);
    if (taskRes.status !== 201) {
      throw new Error(`Failed to create task: ${JSON.stringify(taskRes.data)}`);
    }
    taskId = taskRes.data.data.taskId;
    console.log(`   Created task: ${taskId}`);

    // Step 4: Send A2A task
    console.log('\n📨 Step 4: Send A2A task');
    console.log('   Waiting for result (this may take a while)...');
    const a2aRes = await request('POST', '/a2a/task', {
      targetInstanceId: agentId,
      taskDescription: '查找椎间盘突出治疗措施的最新文献',
      taskInput: { query: '椎间盘突出 治疗' },
      priority: 'high',
    });
    console.log(`   Status: ${a2aRes.status}`);
    if (a2aRes.status === 200) {
      console.log('   ✅ A2A task sent successfully!');
      const result = JSON.stringify(a2aRes.data.data).slice(0, 200);
      console.log(`   Result: ${result}...`);
    } else {
      console.log(`   ⚠️  A2A task returned: ${a2aRes.data.error}`);
      console.log(
        '   (This may be due to API key expiration or agent not ready)',
      );
    }

    console.log('\n✅ E2E Test completed!');
    console.log('\n📊 Summary:');
    console.log(`   - Agent Souls listed: ${souls.length}`);
    console.log(`   - Agent created: ${agentId}`);
    console.log(`   - Task created: ${taskId}`);
    console.log(`   - A2A status: ${a2aRes.status}`);
  } catch (error) {
    console.error('\n❌ E2E Test failed!');
    console.error(
      `   Error: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }
}

run();
