/**
 * Chat system debugging utilities
 */

export const debugChatSystem = {
  // Test if the chat endpoints are accessible
  async testEndpoints() {
    const results = {
      agent: false,
      stream: false,
      backend: false,
      error: null as string | null,
    };

    try {
      // Test agent endpoint
      const agentResponse = await fetch('/api/chat/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: 'test_' + Date.now(),
          message: 'test',
          mode: 'simple',
        }),
      });
      results.agent = agentResponse.ok;

      // Test stream endpoint
      const streamResponse = await fetch(
        '/api/chat/stream?sessionId=test_' + Date.now(),
      );
      results.stream = streamResponse.ok;

      // Test backend endpoints
      const backendResponse = await fetch('/api/chat/backend/create-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      results.backend = backendResponse.ok;
    } catch (error) {
      results.error = error instanceof Error ? error.message : 'Unknown error';
    }

    return results;
  },

  // Log current environment
  logEnvironment() {
    console.log('=== Chat System Debug Info ===');
    console.log('Environment:', process.env.NODE_ENV);
    console.log(
      'Base URL:',
      typeof window !== 'undefined' ? window.location.origin : 'server-side',
    );
    console.log(
      'User Agent:',
      typeof navigator !== 'undefined' ? navigator.userAgent : 'server-side',
    );
    console.log(
      'Current URL:',
      typeof window !== 'undefined' ? window.location.href : 'server-side',
    );
  },
};
