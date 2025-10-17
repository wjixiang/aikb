const { StompImplementation } = require('./stomp-implementation');

async function debugStompConnection() {
  console.log('=== STOMP Connection Debug ===');
  
  // Test with current environment configuration
  console.log('\n1. Testing with current environment configuration:');
  const stompService = new StompImplementation();
  
  try {
    console.log('Attempting to connect...');
    await stompService.initialize();
    console.log('✅ Connection successful!');
    
    // Test health check
    const health = await stompService.healthCheck();
    console.log('Health check result:', JSON.stringify(health, null, 2));
    
    // Close connection
    await stompService.close();
    console.log('✅ Connection closed successfully');
  } catch (error) {
    console.log('❌ Connection failed:', error.message);
    console.log('Connection status:', stompService.getConnectionStatus());
  }
  
  // Test with custom configuration
  console.log('\n2. Testing with custom configuration:');
  
  // Set custom environment variables
  const originalBrokerUrl = process.env.STOMP_BROKER_URL;
  const originalLogin = process.env.STOMP_LOGIN;
  const originalPasscode = process.env.STOMP_PASSCODE;
  const originalHost = process.env.STOMP_VHOST;
  const originalReconnectDelay = process.env.STOMP_RECONNECT_DELAY;
  const originalMaxAttempts = process.env.STOMP_MAX_RECONNECT_ATTEMPTS;
  
  process.env.STOMP_BROKER_URL = 'ws://localhost:15674/ws';
  process.env.STOMP_LOGIN = 'guest';
  process.env.STOMP_PASSCODE = 'guest';
  process.env.STOMP_VHOST = '/';
  process.env.STOMP_RECONNECT_DELAY = '2000';
  process.env.STOMP_MAX_RECONNECT_ATTEMPTS = '2';
  
  const customService = new StompImplementation();
  
  // Restore environment variables
  if (originalBrokerUrl) {
    process.env.STOMP_BROKER_URL = originalBrokerUrl;
  } else {
    delete process.env.STOMP_BROKER_URL;
  }
  if (originalLogin) {
    process.env.STOMP_LOGIN = originalLogin;
  } else {
    delete process.env.STOMP_LOGIN;
  }
  if (originalPasscode) {
    process.env.STOMP_PASSCODE = originalPasscode;
  } else {
    delete process.env.STOMP_PASSCODE;
  }
  if (originalHost) {
    process.env.STOMP_VHOST = originalHost;
  } else {
    delete process.env.STOMP_VHOST;
  }
  if (originalReconnectDelay) {
    process.env.STOMP_RECONNECT_DELAY = originalReconnectDelay;
  } else {
    delete process.env.STOMP_RECONNECT_DELAY;
  }
  if (originalMaxAttempts) {
    process.env.STOMP_MAX_RECONNECT_ATTEMPTS = originalMaxAttempts;
  } else {
    delete process.env.STOMP_MAX_RECONNECT_ATTEMPTS;
  }
  
  try {
    console.log('Attempting to connect with custom config...');
    await customService.initialize();
    console.log('✅ Custom connection successful!');
    
    // Test health check
    const health = await customService.healthCheck();
    console.log('Health check result:', JSON.stringify(health, null, 2));
    
    await customService.close();
    console.log('✅ Custom connection closed successfully');
  } catch (error) {
    console.log('❌ Custom connection failed:', error.message);
    console.log('Connection status:', customService.getConnectionStatus());
  }
  
  console.log('\n=== Debug Complete ===');
}

debugStompConnection().catch(console.error);