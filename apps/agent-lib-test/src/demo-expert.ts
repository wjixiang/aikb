import 'reflect-metadata'
import { ExpertExecutor, ExpertRegistry } from 'agent-lib'
import config from '../experts/hi-agent/index.js'
import type { ExpertTask } from 'agent-lib'

async function main() {
    const apiKey = process.env['MINIMAX_API_KEY'];

    if (!apiKey) {
        throw new Error('No API key found. Set ANTHROPIC_API_KEY, OPENAI_API_KEY, or GLM_API_KEY');
    }

    // 1. Create ExpertExecutor
    const registry = new ExpertRegistry();
    const executor = new ExpertExecutor(registry);
    config.apiConfiguration = {
        apiProvider: 'minimax',
        apiKey: apiKey,
        apiModelId: 'Minimax-m2'
    }

    // 2. Register ExpertConfig
    executor.registerExpert(config);

    // 3. Create Expert instance
    const expert = await executor.createExpert(config.expertId);

    // 4. Activate the expert
    await expert.activate();

    // 5. Define task
    const task: ExpertTask = {
        taskId: `task-${Date.now()}`,
        description: '测试你的工具交互能力：使用计算器计算1+1等于几',
        input: {},
    };

    // 6. Execute task
    const result = await expert.execute(task);

    // 7. Check result
    console.log('Expert status:', expert.status);
    console.log('Task ID:', task.taskId);
    console.log('Result:', result);
}

main()