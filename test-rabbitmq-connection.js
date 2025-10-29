const amqp = require('amqplib');

async function testConnection() {
  console.log('Testing RabbitMQ connection...');
  
  const connectionOptions = {
    hostname: 'rabbitmq',
    port: 5672,
    username: 'admin',
    password: 'admin123',
    vhost: 'my_vhost',
    heartbeat: 60,
  };

  try {
    console.log('Attempting to connect with options:', connectionOptions);
    const connection = await amqp.connect(connectionOptions);
    console.log('✅ Connection successful!');
    
    const channel = await connection.createChannel();
    console.log('✅ Channel created successfully!');
    
    await channel.close();
    await connection.close();
    console.log('✅ Connection closed successfully!');
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    console.error('Full error:', error);
  }
}

testConnection();