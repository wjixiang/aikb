import { Client } from '@stomp/stompjs';
import { WebSocket } from 'ws';
import { config } from 'dotenv';
config();

// Add WebSocket polyfill for Node.js environment
(global as any).WebSocket = WebSocket;

// Configuration from your docker-compose.yml
const theconfig = {
  host: process.env.RABBITMQ_HOSTNAME || 'localhost',
  port: parseInt(process.env.RABBITMQ_STOMP_PORT || '15674'),
  username: process.env.RABBITMQ_USERNAME || 'admin',
  password: process.env.RABBITMQ_PASSWORD || 'admin123',
  vhost: process.env.RABBITMQ_VHOST || 'my_vhost',
};

// STOMP WebSocket URL
const stompUrl = `ws://${theconfig.host}:${theconfig.port}/ws`;

console.log('🔍 Testing RabbitMQ STOMP connection...');
console.log(`📍 Connecting to: ${stompUrl}`);
console.log(`👤 Username: ${theconfig.username}`);
console.log(`🏠 Virtual Host: ${theconfig.vhost}`);
console.log('');

async function testStompConnection() {
  const client = new Client({
    brokerURL: stompUrl,
    connectHeaders: {
      login: theconfig.username,
      passcode: theconfig.password,
      host: theconfig.vhost,
    },
    debug: function (str) {
      console.log('🐛 STOMP Debug:', str);
    },
    reconnectDelay: 5000,
    heartbeatIncoming: 4000,
    heartbeatOutgoing: 4000,
  });

  return new Promise<void>((resolve, reject) => {
    let isConnected = false;
    let testCompleted = false;

    // Connection success handler
    client.onConnect = (frame) => {
      console.log('✅ STOMP connection established successfully!');
      console.log('📋 Connected frame:', frame);
      console.log('');

      isConnected = true;

      // Test 1: Subscribe to a test queue
      console.log('🧪 Test 1: Subscribing to test queue...');
      const subscription = client.subscribe('/queue/test-stomp-queue', (message) => {
        console.log('📨 Received message:', message.body);
      });

      // Test 2: Send a test message
      console.log('🧪 Test 2: Sending test message...');
      client.publish({
        destination: '/queue/test-stomp-queue',
        body: JSON.stringify({
          timestamp: new Date().toISOString(),
          message: 'Hello from STOMP test!',
          test: true,
        }),
        headers: {
          'content-type': 'application/json',
        },
      });

      // Test 3: Check connection health
      console.log('🧪 Test 3: Checking connection health...');
      setTimeout(() => {
        if (isConnected && !testCompleted) {
          console.log('✅ Connection is healthy and responsive');
          console.log('');

          // Clean up
          subscription.unsubscribe();
          client.deactivate();
          
          testCompleted = true;
          resolve();
        }
      }, 2000);
    };

    // Connection error handler
    client.onStompError = (frame) => {
      console.error('❌ STOMP connection error:', frame);
      console.error('📋 Error details:', frame.headers['message']);
      
      if (!testCompleted) {
        testCompleted = true;
        reject(new Error(`STOMP connection failed: ${frame.headers['message']}`));
      }
    };

    // Disconnect handler
    client.onDisconnect = () => {
      console.log('🔌 STOMP connection disconnected');
      if (isConnected && !testCompleted) {
        testCompleted = true;
        resolve();
      }
    };

    // WebSocket error handler
    client.onWebSocketError = (error) => {
      console.error('❌ WebSocket error:', error);
      if (!testCompleted) {
        testCompleted = true;
        reject(new Error(`WebSocket error: ${error.message}`));
      }
    };

    // Start connection
    console.log('🚀 Initiating STOMP connection...');
    client.activate();

    // Timeout handler
    setTimeout(() => {
      if (!testCompleted) {
        testCompleted = true;
        if (isConnected) {
          console.log('⚠️ Connection test timed out but connection was established');
          client.deactivate();
          resolve();
        } else {
          reject(new Error('Connection test timed out'));
        }
      }
    }, 10000);
  });
}

// Alternative test using direct WebSocket connection
async function testWebSocketConnection() {
  console.log('🔍 Testing direct WebSocket connection to RabbitMQ STOMP endpoint...');
  
  return new Promise<void>((resolve, reject) => {
    const ws = new WebSocket(stompUrl);
    
    ws.on('open', () => {
      console.log('✅ WebSocket connection opened successfully!');
      
      // Send CONNECT frame
      const connectFrame = [
        'CONNECT',
        `login:${theconfig.username}`,
        `passcode:${theconfig.password}`,
        `host:${theconfig.vhost}`,
        'accept-version:1.1,1.0',
        'heart-beat:4000,4000',
        '',
        '\u0000',
      ].join('\n');
      
      ws.send(connectFrame);
      console.log('📤 Sent CONNECT frame');
    });
    
    ws.on('message', (data) => {
      const message = data.toString();
      console.log('📥 Received:', message);
      
      if (message.includes('CONNECTED')) {
        console.log('✅ STOMP handshake successful!');
        ws.close();
        resolve();
      } else if (message.includes('ERROR')) {
        console.error('❌ STOMP error received:', message);
        ws.close();
        reject(new Error('STOMP error during handshake'));
      }
    });
    
    ws.on('error', (error) => {
      console.error('❌ WebSocket error:', error);
      reject(error);
    });
    
    ws.on('close', () => {
      console.log('🔌 WebSocket connection closed');
    });
    
    // Timeout
    setTimeout(() => {
      if (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN) {
        ws.close();
        reject(new Error('WebSocket connection timeout'));
      }
    }, 5000);
  });
}

// Main execution
async function main() {
  try {
    console.log('='.repeat(60));
    console.log('🐰 AMQP STOMP CONNECTION TEST');
    console.log('='.repeat(60));
    console.log('');

    // First test: Direct WebSocket connection
    try {
      await testWebSocketConnection();
      console.log('');
      console.log('✅ WebSocket test passed!');
    } catch (error) {
      console.error('❌ WebSocket test failed:', error);
      console.log('');
    }

    // Second test: Full STOMP client test
    try {
      await testStompConnection();
      console.log('✅ STOMP client test passed!');
    } catch (error) {
      console.error('❌ STOMP client test failed:', error);
    }

    console.log('');
    console.log('='.repeat(60));
    console.log('🎉 TEST COMPLETED');
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('💥 Test failed with error:', error);
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  main().catch((error) => {
    console.error('💥 Unhandled error:', error);
    process.exit(1);
  });
}

export { testStompConnection, testWebSocketConnection };