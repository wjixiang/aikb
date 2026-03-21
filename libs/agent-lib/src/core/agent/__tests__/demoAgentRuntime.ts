/**
 * demoAgentRuntime.ts - Multi-Agent Runtime Demonstration
 *
 * This demo showcases the AgentRuntime system managing multiple agents:
 * 1. Creates an AgentRuntime instance
 * 2. Creates multiple agents with different types (pubmed-retrieve, paper-analysis)
 * 3. Starts the runtime
 * 4. Submits tasks to specific agents via targetInstanceId
 * 5. Listens for task completion events
 * 6. Demonstrates workspace.exportResult() result collection
 *
 * NEW: Components are now registered directly in createAgent() options!
 */

import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config as dotenvConfig } from 'dotenv';
import pino from 'pino';

// Load .env BEFORE importing souls (they use process.env at module level)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenvConfig({ path: join(__dirname, '..', '..', '..', '..', '.env') });

import { createAgentRuntime } from '../../runtime';
import type { RuntimeEvent } from '../../runtime/types.js';
import { createBibRetrieveAgentSoul } from '../../agent-soul';

// Setup logger
const logger = pino({
    level: process.env['LOG_LEVEL'] || 'info',
    formatters: {
        level: (label) => ({ level: label }),
    },
    timestamp: pino.stdTimeFunctions.isoTime,
});

/**
 * Demo: Multi-Agent Runtime with PubMed Search and Paper Analysis
 */
async function main() {
    logger.info('[AgentRuntime Demo] Starting...');

    // ============================================================
    // Step 1: Create AgentRuntime instance
    // ============================================================
    const runtime = createAgentRuntime({
        maxAgents: 5,
    });

    logger.info({ maxAgents: 5 }, '[AgentRuntime Demo] Runtime created');

    // ============================================================
    // Step 2: Subscribe to runtime events
    // ============================================================
    runtime.on('agent:created', (event: RuntimeEvent) => {
        logger.info({ payload: event.payload }, '[AgentRuntime Demo] Agent created');
    });

    runtime.on('task:submitted', (event: RuntimeEvent) => {
        logger.info({ payload: event.payload }, '[AgentRuntime Demo] Task submitted');
    });

    runtime.on('task:assigned', (event: RuntimeEvent) => {
        logger.info({ payload: event.payload }, '[AgentRuntime Demo] Task assigned to agent');
    });

    runtime.on('task:completed', (event: RuntimeEvent) => {
        const payload = event.payload as { taskId: string; instanceId: string; results: unknown };
        logger.info(
            { taskId: payload.taskId, instanceId: payload.instanceId, results: payload.results },
            '[AgentRuntime Demo] Task completed',
        );
    });

    runtime.on('task:failed', (event: RuntimeEvent) => {
        const payload = event.payload as { taskId: string; instanceId: string; error: string };
        logger.error(
            { taskId: payload.taskId, instanceId: payload.instanceId, error: payload.error },
            '[AgentRuntime Demo] Task failed',
        );
    });

    // ============================================================
    // Step 3: Create PubMed Retrieve Agent (with soul!)
    // ============================================================
    logger.info('[AgentRuntime Demo] Creating PubMed Retrieve Agent...');

    const pubmedAgentId = await runtime.createAgent(createBibRetrieveAgentSoul());

    logger.info('[AgentRuntime Demo] PubMed agent created with components registered');

    // ============================================================
    // Step 4: Create Paper Analysis Agent (with components!)
    // // ============================================================
    // logger.info('[AgentRuntime Demo] Creating Paper Analysis Agent...');

    // const analysisAgentId = await runtime.createAgent(createBibRetrieveAgentSoul());

    // logger.info('[AgentRuntime Demo] Analysis agent created with components registered');

    // ============================================================
    // Step 5: List all agents
    // ============================================================
    const allAgents = await runtime.listAgents();
    logger.info(
        {
            count: allAgents.length,
            agents: allAgents.map((a) => ({
                instanceId: a.instanceId,
                name: a.name,
                type: a.agentType,
                status: a.status,
            })),
        },
        '[AgentRuntime Demo] All agents registered',
    );

    // ============================================================
    // Step 6: Start the runtime (enables task polling)
    // ============================================================
    await runtime.start();
    logger.info('[AgentRuntime Demo] Runtime started - task polling enabled');

    // ============================================================
    // Step 7: Submit tasks to specific agents
    // ============================================================

    // Task 1: Submit to PubMed Retrieve Agent
    logger.info('[AgentRuntime Demo] Submitting task to PubMed agent...');
    const task1Id = await runtime.submitTask({
        description: '执行综述写作文献检索任务。要求围绕椎间盘突出进行全面细致的文献检索。',
        priority: 'high',
        targetInstanceId: pubmedAgentId,
    });
    logger.info({ taskId: task1Id, agentId: pubmedAgentId }, '[AgentRuntime Demo] Task submitted');

    // Task 2: Submit to Paper Analysis Agent
    // logger.info('[AgentRuntime Demo] Submitting task to Analysis agent...');
    // const task2Id = await runtime.submitTask({
    //     description: '分析并总结最近关于人工智能在医疗诊断中应用的文献，重点关注准确性和临床验证。',
    //     priority: 'normal',
    //     targetInstanceId: analysisAgentId,
    // });
    // logger.info({ taskId: task2Id, agentId: analysisAgentId }, '[AgentRuntime Demo] Task submitted');

    // ============================================================
    // Step 8: Monitor task status
    // ============================================================

    // Wait a bit for tasks to be assigned
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const task1Status = await runtime.getTaskStatus(task1Id);
    logger.info(
        { taskId: task1Id, status: task1Status?.status, description: task1Status?.description },
        '[AgentRuntime Demo] Task 1 status',
    );

    // const task2Status = await runtime.getTaskStatus(task2Id);
    // logger.info(
    //     { taskId: task2Id, status: task2Status?.status, description: task2Status?.description },
    //     '[AgentRuntime Demo] Task 2 status',
    // );

    // ============================================================
    // Step 9: Get runtime statistics
    // ============================================================
    const stats = await runtime.getStats();
    logger.info(
        {
            totalAgents: stats.totalAgents,
            agentsByStatus: stats.agentsByStatus,
            totalPendingTasks: stats.totalPendingTasks,
            totalProcessingTasks: stats.totalProcessingTasks,
        },
        '[AgentRuntime Demo] Runtime statistics',
    );

    // ============================================================
    // Step 10: Get pending tasks for specific agent
    // ============================================================
    const pubmedPendingTasks = await runtime.getPendingTasks(pubmedAgentId);
    logger.info(
        {
            count: pubmedPendingTasks.length,
            tasks: pubmedPendingTasks.map((t) => ({
                taskId: t.taskId,
                description: t.description,
                priority: t.priority,
            })),
        },
        '[AgentRuntime Demo] Pending tasks for PubMed agent',
    );

    // ============================================================
    // Keep the demo running for a while to observe task execution
    // ============================================================
    logger.info('[AgentRuntime Demo] Demo running... Press Ctrl+C to exit');

    // Wait for tasks to complete (or timeout after 5 minutes)
    const timeout = 5 * 60 * 1000; // 5 minutes
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
        await new Promise((resolve) => setTimeout(resolve, 10000));

        const currentStats = await runtime.getStats();
        logger.info(
            { processingTasks: currentStats.totalProcessingTasks, pendingTasks: currentStats.totalPendingTasks },
            '[AgentRuntime Demo] Current status',
        );

        // Check if all tasks are done
        if (currentStats.totalProcessingTasks === 0 && currentStats.totalPendingTasks === 0) {
            logger.info('[AgentRuntime Demo] All tasks completed!');
            break;
        }
    }

    // ============================================================
    // Cleanup
    // ============================================================
    logger.info('[AgentRuntime Demo] Stopping runtime...');
    await runtime.stop();

    logger.info('[AgentRuntime Demo] Demo completed');
}

// Run the demo
main().catch((error) => {
    logger.error(
        {
            error: error instanceof Error ? {
                message: error.message,
                stack: error.stack,
                name: error.name,
            } : error,
        },
        '[AgentRuntime Demo] Error',
    );
    process.exit(1);
});
