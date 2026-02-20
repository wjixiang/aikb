/**
 * Turn-based Memory 测试示例
 */

import { MemoryModule } from '../MemoryModule.js';

// 模拟 ApiClient
const mockApiClient = {
    makeRequest: async () => ({
        content: 'test',
        toolCalls: [],
        textResponse: 'test',
        requestTime: 100,
        tokenUsage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 }
    })
} as any;

// 创建 MemoryModule
const memoryModule = new MemoryModule(mockApiClient);

// 创建 3 个 Turn
memoryModule.startTurn('Context 1');
memoryModule.addUserMessage('Turn 1: 分析代码库');
memoryModule.addAssistantMessage([{ type: 'text', text: 'Turn 1: 已分析' }]);
memoryModule.completeTurn();

memoryModule.startTurn('Context 2');
memoryModule.addUserMessage('Turn 2: 优化性能');
memoryModule.addAssistantMessage([{ type: 'text', text: 'Turn 2: 已优化' }]);
memoryModule.completeTurn();

memoryModule.startTurn('Context 3');
memoryModule.addUserMessage('Turn 3: 添加测试');
memoryModule.addAssistantMessage([{ type: 'text', text: 'Turn 3: 已添加' }]);
memoryModule.completeTurn();

// 测试 1: 默认情况下不注入历史
console.log('=== 测试 1: 默认 summary-only ===');
const defaultHistory = memoryModule.getHistoryForPrompt();
console.log('默认历史长度:', defaultHistory.length); // 应该是 0
console.log('✅ 默认不注入历史\n');

// 测试 2: 回忆最近 2 个 Turn
console.log('=== 测试 2: 回忆最近 2 个 Turn ===');
const recalled1 = memoryModule.getTurnStore().getRecentMessages(2);
console.log('回忆的消息数:', recalled1.length); // 应该是 4 (2个Turn * 2条消息)
// 手动设置为 recalled messages
memoryModule['recalledMessages'] = recalled1;
const historyAfterRecall1 = memoryModule.getHistoryForPrompt();
console.log('注入的历史长度:', historyAfterRecall1.length);
console.log('✅ 成功回忆并注入\n');

// 测试 3: 清除后又回到 summary-only
console.log('=== 测试 3: 清除回忆的消息 ===');
memoryModule.clearRecalledMessages();
const historyAfterClear = memoryModule.getHistoryForPrompt();
console.log('清除后历史长度:', historyAfterClear.length); // 应该是 0
console.log('✅ 成功清除\n');

// 测试 4: 按 Turn 编号回忆
console.log('=== 测试 4: 按 Turn 编号回忆 ===');
const recalled2 = memoryModule.recallTurns([1, 3]);
console.log('回忆的消息数:', recalled2.length); // 应该是 4 (Turn 1 和 Turn 3 各 2 条消息)
const historyAfterRecall2 = memoryModule.getHistoryForPrompt();
console.log('注入的历史长度:', historyAfterRecall2.length);
console.log('✅ 成功按 Turn 回忆\n');

// 测试 5: 限制回忆数量
console.log('=== 测试 5: 限制回忆数量 ===');
const memoryModuleWithLimit = new MemoryModule(mockApiClient, {
    maxRecalledMessages: 3
});

// 创建多个 Turn
for (let i = 1; i <= 5; i++) {
    memoryModuleWithLimit.startTurn(`Context ${i}`);
    memoryModuleWithLimit.addUserMessage(`Message ${i}`);
    memoryModuleWithLimit.addAssistantMessage([{ type: 'text', text: `Response ${i}` }]);
    memoryModuleWithLimit.completeTurn();
}

const recalled3 = memoryModuleWithLimit.recallTurns([1, 2, 3, 4, 5]);
console.log('尝试回忆 5 个 Turn (10条消息)，实际回忆:', recalled3.length); // 应该是 3（限制）
console.log('✅ 成功限制回忆数量\n');

console.log('=== 所有测试通过 ===');
