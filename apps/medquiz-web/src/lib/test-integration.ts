/**
 * Integration test for the new chat system with Agent integration
 * Run with: npx tsx src/lib/test-integration.ts
 */

import { AgentChatService } from './services/AgentChatService';
import { language } from '@/kgrag/type';

async function testIntegration() {
  console.log('🧪 Testing Agent Integration with New Chat System...\n');

  try {
    // Test 1: Create agent chat service
    console.log('1. Creating AgentChatService...');
    const sessionId = `test_${Date.now()}`;
    const agentConfig = {
      rag_config: {
        useHyDE: true,
        useHybrid: false,
        topK: 10,
        language: 'zh' as language,
      },
    };

    const agentChatService = await AgentChatService.getInstance(
      sessionId,
      agentConfig,
    );
    console.log(`   ✅ AgentChatService created for session: ${sessionId}`);

    // Test 2: Process user query
    console.log('\n2. Processing user query...');
    await agentChatService.processUserQuery('高血压的治疗方法有哪些？', {
      mode: 'agent',
      selectedSource: 'vault',
      useHyDE: true,
      useHybrid: false,
    });
    console.log('   ✅ Query processing initiated');

    // Test 3: Simulate backend-initiated conversation
    console.log('\n3. Testing backend-initiated conversation...');
    await agentChatService.startConversation(
      '您好！我是您的AI医学助手，我可以帮您解答医学问题。',
    );

    setTimeout(async () => {
      await agentChatService.continueConversation(
        '让我为您查找相关的医学资料...',
      );
    }, 1000);

    setTimeout(async () => {
      await agentChatService.completeConversation('希望这些信息对您有帮助！');
    }, 2000);

    console.log('   ✅ Backend conversation initiated');

    // Test 4: Check history
    setTimeout(() => {
      const history = agentChatService.getHistory();
      console.log(`\n4. Conversation history: ${history.length} messages`);
      history.forEach((msg, idx) => {
        console.log(
          `   ${idx + 1}. [${msg.type}] ${msg.content.substring(0, 50)}...`,
        );
      });
    }, 3000);

    // Test 5: Cleanup
    setTimeout(() => {
      agentChatService.clearSession();
      console.log('\n5. ✅ Session cleaned up');
      console.log('\n🎉 Integration test completed successfully!');
    }, 4000);
  } catch (error) {
    console.error('❌ Integration test failed:', error);
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  testIntegration();
}
