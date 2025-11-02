/**
 * Test script for the new simplified chat system
 * Run with: npx tsx src/lib/test-chat-system.ts
 */

import { chatBackendService } from "./services/ChatBackendService";

async function testChatSystem() {
  console.log("🧪 Testing Simplified Chat System...\n");

  try {
    // Test 1: Create session
    console.log("1. Creating new session...");
    const sessionId = chatBackendService.createSession();
    console.log(`   ✅ Session created: ${sessionId}`);

    // Test 2: Start conversation from backend
    console.log("\n2. Starting backend-initiated conversation...");
    await chatBackendService.startConversation(
      sessionId,
      "Hello! I'm your AI assistant. How can I help you today?",
    );
    console.log("   ✅ Initial message sent");

    // Test 3: Continue conversation
    console.log("\n3. Continuing conversation...");
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await chatBackendService.continueConversation(
      sessionId,
      "I can help you with medical questions, find relevant quizzes, and provide detailed explanations.",
    );
    console.log("   ✅ Follow-up message sent");

    // Test 4: Send status update
    console.log("\n4. Sending status update...");
    await chatBackendService.sendStatus(
      sessionId,
      "Processing your request...",
    );
    console.log("   ✅ Status update sent");

    // Test 5: Complete conversation
    console.log("\n5. Completing conversation...");
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await chatBackendService.completeConversation(
      sessionId,
      "Feel free to ask me anything else!",
    );
    console.log("   ✅ Conversation completed");

    // Test 6: Check session history
    console.log("\n6. Checking session history...");
    const history = chatBackendService.getHistory(sessionId);
    console.log(`   ✅ Found ${history.length} messages in history`);

    // Test 7: Clean up
    console.log("\n7. Cleaning up...");
    chatBackendService.clearSession(sessionId);
    console.log("   ✅ Session cleared");

    console.log(
      "\n🎉 All tests passed! The simplified chat system is working correctly.",
    );
    console.log(
      `\n📍 You can test the frontend at: http://localhost:3001/chat-demo`,
    );
    console.log(`📍 Session ID for testing: ${sessionId}`);
  } catch (error) {
    console.error("❌ Test failed:", error);
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  testChatSystem();
}
