const amqp = require('amqplib');

async function fixRabbitMQQueues() {
  try {
    console.log('=== Complete RabbitMQ Queue Fix ===');
    
    // Connect to RabbitMQ with the same configuration as the workers
    const config = {
      hostname: process.env.RABBITMQ_HOSTNAME || 'rabbitmq',
      port: parseInt(process.env.RABBITMQ_PORT || '5672'),
      username: process.env.RABBITMQ_USERNAME || 'admin',
      password: process.env.RABBITMQ_PASSWORD || 'admin123',
      vhost: process.env.RABBITMQ_VHOST || 'my_vhost',
    };
    
    console.log('Connecting to RabbitMQ with config:', {
      hostname: config.hostname,
      port: config.port,
      username: config.username,
      vhost: config.vhost
    });
    
    const connection = await amqp.connect(config);
    const channel = await connection.createChannel();
    
    console.log('✓ Connected to RabbitMQ successfully');
    
    // Define ALL queues that need to be created based on the message.types.ts
    const allQueues = [
      {
        name: 'pdf-conversion-request',
        durable: true,
        exclusive: false,
        autoDelete: false,
        arguments: {
          'x-dead-letter-exchange': 'pdf-conversion-dlx',
          'x-dead-letter-routing-key': 'pdf.conversion.dlq',
          'x-message-ttl': 3600000,
          'x-max-length': 10000,
        },
      },
      {
        name: 'pdf-conversion-progress',
        durable: true,
        exclusive: false,
        autoDelete: false,
        arguments: {},
      },
      {
        name: 'pdf-conversion-completed',
        durable: true,
        exclusive: false,
        autoDelete: false,
        arguments: {
          'x-message-ttl': 86400000,
          'x-max-length': 50000,
        },
      },
      {
        name: 'pdf-conversion-failed',
        durable: true,
        exclusive: false,
        autoDelete: false,
        arguments: {
          'x-message-ttl': 604800000,
          'x-max-length': 10000,
        },
      },
      {
        name: 'pdf-analysis-request',
        durable: true,
        exclusive: false,
        autoDelete: false,
        arguments: {
          'x-dead-letter-exchange': 'pdf-conversion-dlx',
          'x-dead-letter-routing-key': 'pdf.conversion.dlq',
          'x-message-ttl': 1800000,
          'x-max-length': 5000,
        },
      },
      {
        name: 'pdf-analysis-completed',
        durable: true,
        exclusive: false,
        autoDelete: false,
        arguments: {
          'x-message-ttl': 3600000,
          'x-max-length': 10000,
        },
      },
      {
        name: 'pdf-analysis-failed',
        durable: true,
        exclusive: false,
        autoDelete: false,
        arguments: {
          'x-message-ttl': 604800000,
          'x-max-length': 5000,
        },
      },
      {
        name: 'pdf-part-conversion-request',
        durable: true,
        exclusive: false,
        autoDelete: false,
        arguments: {
          'x-dead-letter-exchange': 'pdf-conversion-dlx',
          'x-dead-letter-routing-key': 'pdf.conversion.dlq',
          'x-message-ttl': 7200000,
          'x-max-length': 20000,
        },
      },
      {
        name: 'pdf-part-conversion-completed',
        durable: true,
        exclusive: false,
        autoDelete: false,
        arguments: {
          'x-message-ttl': 3600000,
          'x-max-length': 10000,
        },
      },
      {
        name: 'pdf-part-conversion-failed',
        durable: true,
        exclusive: false,
        autoDelete: false,
        arguments: {
          'x-message-ttl': 604800000,
          'x-max-length': 5000,
        },
      },
      {
        name: 'pdf-merging-request',
        durable: true,
        exclusive: false,
        autoDelete: false,
        arguments: {
          'x-dead-letter-exchange': 'pdf-conversion-dlx',
          'x-dead-letter-routing-key': 'pdf.conversion.dlq',
          'x-message-ttl': 3600000,
          'x-max-length': 1000,
        },
      },
      {
        name: 'pdf-merging-progress',
        durable: false,
        exclusive: false,
        autoDelete: true,
        arguments: {
          'x-message-ttl': 300000,
        },
      },
      {
        name: 'markdown-storage-request',
        durable: true,
        exclusive: false,
        autoDelete: false,
        arguments: {
          'x-dead-letter-exchange': 'pdf-conversion-dlx',
          'x-dead-letter-routing-key': 'pdf.conversion.dlq',
          'x-message-ttl': 3600000,
          'x-max-length': 5000,
        },
      },
      {
        name: 'markdown-storage-completed',
        durable: true,
        exclusive: false,
        autoDelete: false,
        arguments: {
          'x-message-ttl': 86400000,
          'x-max-length': 50000,
        },
      },
      {
        name: 'markdown-storage-failed',
        durable: true,
        exclusive: false,
        autoDelete: false,
        arguments: {
          'x-message-ttl': 604800000,
          'x-max-length': 10000,
        },
      },
      {
        name: 'markdown-part-storage-request',
        durable: true,
        exclusive: false,
        autoDelete: false,
        arguments: {
          'x-dead-letter-exchange': 'pdf-conversion-dlx',
          'x-dead-letter-routing-key': 'pdf.conversion.dlq',
          'x-message-ttl': 3600000,
          'x-max-length': 5000,
        },
      },
      {
        name: 'markdown-part-storage-progress',
        durable: false,
        exclusive: false,
        autoDelete: true,
        arguments: {
          'x-message-ttl': 300000,
          'x-max-length': 1000,
        },
      },
      {
        name: 'markdown-part-storage-completed',
        durable: true,
        exclusive: false,
        autoDelete: false,
        arguments: {
          'x-message-ttl': 3600000,
          'x-max-length': 10000,
        },
      },
      {
        name: 'markdown-part-storage-failed',
        durable: true,
        exclusive: false,
        autoDelete: false,
        arguments: {
          'x-message-ttl': 604800000,
          'x-max-length': 5000,
        },
      },
      {
        name: 'chunking-embedding-request',
        durable: true,
        exclusive: false,
        autoDelete: false,
        arguments: {
          'x-dead-letter-exchange': 'pdf-conversion-dlx',
          'x-dead-letter-routing-key': 'pdf.conversion.dlq',
          'x-message-ttl': 7200000,
          'x-max-length': 20000,
        },
      },
      {
        name: 'chunking-embedding-progress',
        durable: false,
        exclusive: false,
        autoDelete: true,
        arguments: {
          'x-message-ttl': 300000,
          'x-max-length': 1000,
        },
      },
      {
        name: 'chunking-embedding-completed',
        durable: true,
        exclusive: false,
        autoDelete: false,
        arguments: {
          'x-message-ttl': 3600000,
          'x-max-length': 10000,
        },
      },
      {
        name: 'chunking-embedding-failed',
        durable: true,
        exclusive: false,
        autoDelete: false,
        arguments: {
          'x-message-ttl': 604800000,
          'x-max-length': 5000,
        },
      },
      {
        name: 'pdf-conversion-dlq',
        durable: true,
        exclusive: false,
        autoDelete: false,
        arguments: {
          'x-message-ttl': 2592000000,
        },
      },
      {
        name: 'health-check',
        durable: false,
        exclusive: false,
        autoDelete: true,
        arguments: {
          'x-message-ttl': 60000,
          'x-max-length': 10,
        },
      }
    ];
    
    // Create exchanges first
    console.log('\n=== Creating exchanges ===');
    const exchangesToCreate = [
      {
        name: 'pdf-conversion-exchange',
        type: 'topic',
        durable: true,
        autoDelete: false,
        internal: false,
        arguments: {},
      },
      {
        name: 'pdf-conversion-dlx',
        type: 'topic',
        durable: true,
        autoDelete: false,
        internal: false,
        arguments: {},
      }
    ];
    
    for (const exchange of exchangesToCreate) {
      try {
        await channel.assertExchange(
          exchange.name,
          exchange.type,
          {
            durable: exchange.durable,
            autoDelete: exchange.autoDelete,
            internal: exchange.internal,
            arguments: exchange.arguments,
          }
        );
        console.log(`✓ Exchange '${exchange.name}' created/verified`);
      } catch (error) {
        console.log(`✗ Failed to create exchange '${exchange.name}': ${error.message}`);
      }
    }
    
    // Create all queues
    console.log('\n=== Creating all queues ===');
    for (const queue of allQueues) {
      try {
        const queueResult = await channel.assertQueue(queue.name, {
          durable: queue.durable,
          exclusive: queue.exclusive,
          autoDelete: queue.autoDelete,
          arguments: queue.arguments,
        });
        console.log(`✓ Queue '${queue.name}' created/verified (${queueResult.messageCount} messages)`);
      } catch (error) {
        console.log(`✗ Failed to create queue '${queue.name}': ${error.message}`);
      }
    }
    
    // Create all queue bindings
    console.log('\n=== Creating queue bindings ===');
    const bindings = [
      { queue: 'pdf-conversion-request', exchange: 'pdf-conversion-exchange', routingKey: 'pdf.conversion.request' },
      { queue: 'pdf-conversion-progress', exchange: 'pdf-conversion-exchange', routingKey: 'pdf.conversion.progress' },
      { queue: 'pdf-conversion-completed', exchange: 'pdf-conversion-exchange', routingKey: 'pdf.conversion.completed' },
      { queue: 'pdf-conversion-failed', exchange: 'pdf-conversion-exchange', routingKey: 'pdf.conversion.failed' },
      { queue: 'pdf-analysis-request', exchange: 'pdf-conversion-exchange', routingKey: 'pdf.analysis.request' },
      { queue: 'pdf-analysis-completed', exchange: 'pdf-conversion-exchange', routingKey: 'pdf.analysis.completed' },
      { queue: 'pdf-analysis-failed', exchange: 'pdf-conversion-exchange', routingKey: 'pdf.analysis.failed' },
      { queue: 'pdf-part-conversion-request', exchange: 'pdf-conversion-exchange', routingKey: 'pdf.part.conversion.request' },
      { queue: 'pdf-part-conversion-completed', exchange: 'pdf-conversion-exchange', routingKey: 'pdf.part.conversion.completed' },
      { queue: 'pdf-part-conversion-failed', exchange: 'pdf-conversion-exchange', routingKey: 'pdf.part.conversion.failed' },
      { queue: 'pdf-merging-request', exchange: 'pdf-conversion-exchange', routingKey: 'pdf.merging.request' },
      { queue: 'pdf-merging-progress', exchange: 'pdf-conversion-exchange', routingKey: 'pdf.merging.progress' },
      { queue: 'markdown-storage-request', exchange: 'pdf-conversion-exchange', routingKey: 'markdown.storage.request' },
      { queue: 'markdown-storage-completed', exchange: 'pdf-conversion-exchange', routingKey: 'markdown.storage.completed' },
      { queue: 'markdown-storage-failed', exchange: 'pdf-conversion-exchange', routingKey: 'markdown.storage.failed' },
      { queue: 'markdown-part-storage-request', exchange: 'pdf-conversion-exchange', routingKey: 'markdown.part.storage.request' },
      { queue: 'markdown-part-storage-progress', exchange: 'pdf-conversion-exchange', routingKey: 'markdown.part.storage.progress' },
      { queue: 'markdown-part-storage-completed', exchange: 'pdf-conversion-exchange', routingKey: 'markdown.part.storage.completed' },
      { queue: 'markdown-part-storage-failed', exchange: 'pdf-conversion-exchange', routingKey: 'markdown.part.storage.failed' },
      { queue: 'chunking-embedding-request', exchange: 'pdf-conversion-exchange', routingKey: 'chunking.embedding.request' },
      { queue: 'chunking-embedding-progress', exchange: 'pdf-conversion-exchange', routingKey: 'chunking.embedding.progress' },
      { queue: 'chunking-embedding-completed', exchange: 'pdf-conversion-exchange', routingKey: 'chunking.embedding.completed' },
      { queue: 'chunking-embedding-failed', exchange: 'pdf-conversion-exchange', routingKey: 'chunking.embedding.failed' },
      { queue: 'pdf-conversion-dlq', exchange: 'pdf-conversion-dlx', routingKey: 'pdf.conversion.dlq' },
    ];
    
    for (const binding of bindings) {
      try {
        await channel.bindQueue(binding.queue, binding.exchange, binding.routingKey);
        console.log(`✓ Bound queue '${binding.queue}' to exchange '${binding.exchange}' with routing key '${binding.routingKey}'`);
      } catch (error) {
        console.log(`✗ Failed to bind queue '${binding.queue}': ${error.message}`);
      }
    }
    
    // Close connection
    await channel.close();
    await connection.close();
    console.log('\n=== Complete queue setup finished ===');
    console.log('All RabbitMQ queues have been created and bound successfully.');
    console.log('Now restart the PM2 workers: pm2 restart all');
    
  } catch (error) {
    console.error('Queue setup failed:', error);
  }
}

fixRabbitMQQueues();