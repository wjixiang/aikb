#!/bin/bash

echo "🔧 RabbitMQ 连接修复脚本"
echo "========================"

# 1. 检查并更新环境变量配置
echo "1. 更新 RabbitMQ 配置..."

# 创建或更新 .env 文件
cat >> .env << EOF

# RabbitMQ Configuration (matching docker-compose.yml)
RABBITMQ_URL=amqp://rabbitmq:5672
RABBITMQ_HOSTNAME=rabbitmq
RABBITMQ_PORT=5672
RABBITMQ_USERNAME=admin
RABBITMQ_PASSWORD=admin123
RABBITMQ_VHOST=my_vhost
EOF

echo "✅ 已更新 .env 文件"

# 2. 检查 docker-compose.yml 中的网络配置
echo "2. 检查 docker-compose.yml 网络配置..."

# 确保 app 服务依赖于 rabbitmq
if ! grep -q "rabbitmq:" .devcontainer/docker-compose.yml; then
    echo "❌ docker-compose.yml 中缺少 rabbitmq 服务定义"
    exit 1
fi

# 确保 app 服务有 depends_on: rabbitmq
if ! grep -A 5 "depends_on:" .devcontainer/docker-compose.yml | grep -q "rabbitmq"; then
    echo "⚠️ app 服务缺少对 rabbitmq 的依赖"
fi

echo "✅ docker-compose.yml 检查完成"

# 3. 创建启动脚本
echo "3. 创建 RabbitMQ 启动脚本..."

cat > start-rabbitmq.sh << 'EOF'
#!/bin/bash

echo "🚀 启动 RabbitMQ 服务..."

# 检查是否在 dev container 中
if [ -f "/.dockerenv" ]; then
    echo "检测到 dev container 环境"
    
    # 尝试从容器内部启动 RabbitMQ
    if command -v docker-compose &> /dev/null; then
        echo "使用 docker-compose 启动服务..."
        cd /workspace/.devcontainer
        docker-compose up -d rabbitmq
        
        # 等待 RabbitMQ 启动
        echo "等待 RabbitMQ 启动..."
        sleep 10
        
        # 检查服务状态
        docker-compose ps rabbitmq
    else
        echo "❌ docker-compose 不可用，请手动启动 RabbitMQ 容器"
    fi
else
    echo "不在 dev container 中，请手动启动 RabbitMQ"
fi

echo "✅ RabbitMQ 启动脚本创建完成"
EOF

chmod +x start-rabbitmq.sh
echo "✅ 已创建 start-rabbitmq.sh 脚本"

# 4. 创建更新后的配置文件
echo "4. 创建更新的 RabbitMQ 配置..."

cat > knowledgeBase/lib/rabbitmq/rabbitmq.config.updated.ts << 'EOF'
import { RabbitMQConfig, RabbitMQQueueConfig, RabbitMQExchangeConfig } from './message.types';

/**
 * Updated RabbitMQ configuration to match docker-compose.yml
 */
export const updatedRabbitMQConfig: RabbitMQConfig = {
  url: process.env.RABBITMQ_URL || 'amqp://rabbitmq:5672',
  hostname: process.env.RABBITMQ_HOSTNAME || 'rabbitmq',
  port: parseInt(process.env.RABBITMQ_PORT || '5672'),
  username: process.env.RABBITMQ_USERNAME || 'admin',
  password: process.env.RABBITMQ_PASSWORD || 'admin123',
  vhost: process.env.RABBITMQ_VHOST || 'my_vhost',
  frameMax: parseInt(process.env.RABBITMQ_FRAME_MAX || '0'),
  heartbeat: parseInt(process.env.RABBITMQ_HEARTBEAT || '60'),
  locale: process.env.RABBITMQ_LOCALE || 'en_US',
};

/**
 * Get updated RabbitMQ configuration
 */
export function getUpdatedRabbitMQConfig(): RabbitMQConfig {
  return updatedRabbitMQConfig;
}

/**
 * Validate updated RabbitMQ configuration
 */
export function validateUpdatedRabbitMQConfig(config: RabbitMQConfig): boolean {
  if (!config.url && (!config.hostname || !config.port)) {
    console.error('RabbitMQ URL or hostname and port are required');
    return false;
  }

  if (config.username && !config.password) {
    console.error('RabbitMQ password is required when username is provided');
    return false;
  }

  if (config.password && !config.username) {
    console.error('RabbitMQ username is required when password is provided');
    return false;
  }

  return true;
}

/**
 * Get validated updated RabbitMQ configuration
 */
export function getValidatedUpdatedRabbitMQConfig(): RabbitMQConfig | null {
  const config = getUpdatedRabbitMQConfig();

  if (!validateUpdatedRabbitMQConfig(config)) {
    return null;
  }

  return config;
}
EOF

echo "✅ 已创建更新的配置文件"

# 5. 创建测试脚本
echo "5. 创建连接验证脚本..."

cat > verify-rabbitmq-connection.ts << 'EOF'
import * as amqp from 'amqplib';
import { getValidatedUpdatedRabbitMQConfig } from './knowledgeBase/lib/rabbitmq/rabbitmq.config.updated';
import createLoggerWithPrefix from './knowledgeBase/lib/logger';

const logger = createLoggerWithPrefix('RabbitMQConnectionVerify');

async function verifyConnection(): Promise<boolean> {
  logger.info('🔍 验证 RabbitMQ 连接...');
  
  const config = getValidatedUpdatedRabbitMQConfig();
  if (!config) {
    logger.error('❌ 无效的 RabbitMQ 配置');
    return false;
  }
  
  logger.info('配置信息:', {
    hostname: config.hostname,
    port: config.port,
    username: config.username,
    vhost: config.vhost,
  });
  
  try {
    logger.info('正在连接到 RabbitMQ...');
    const connection = await amqp.connect(config);
    logger.info('✅ 连接成功！');
    
    const channel = await connection.createChannel();
    logger.info('✅ 通道创建成功！');
    
    // 测试基本操作
    await channel.assertQueue('verify-test-queue', { durable: false });
    logger.info('✅ 队列创建成功！');
    
    // 清理
    await channel.close();
    await connection.close();
    logger.info('✅ 连接关闭成功！');
    
    return true;
  } catch (error) {
    logger.error('❌ 连接失败:', error);
    return false;
  }
}

// 运行验证
verifyConnection()
  .then(success => {
    if (success) {
      logger.info('🎉 RabbitMQ 连接验证成功！');
      process.exit(0);
    } else {
      logger.error('❌ RabbitMQ 连接验证失败！');
      process.exit(1);
    }
  })
  .catch(error => {
    logger.error('验证脚本失败:', error);
    process.exit(1);
  });
EOF

echo "✅ 已创建连接验证脚本"

echo ""
echo "🎯 修复步骤总结："
echo "=================="
echo "1. ✅ 已更新 .env 文件，包含正确的 RabbitMQ 配置"
echo "2. ✅ 已检查 docker-compose.yml 配置"
echo "3. ✅ 已创建 start-rabbitmq.sh 启动脚本"
echo "4. ✅ 已创建更新的配置文件"
echo "5. ✅ 已创建连接验证脚本"
echo ""
echo "📋 下一步操作："
echo "==============="
echo "1. 运行启动脚本: ./start-rabbitmq.sh"
echo "2. 验证连接: npx ts-node verify-rabbitmq-connection.ts"
echo "3. 如果仍有问题，请检查:"
echo "   - Docker 服务是否正常运行"
echo "   - dev container 网络配置"
echo "   - 防火墙设置"
echo ""
echo "🔍 故障排除："
echo "=============="
echo "如果连接仍然失败，请运行以下命令进行详细诊断："
echo "- npx ts-node test-rabbitmq-connection.ts"
echo "- 检查容器日志: docker logs <rabbitmq-container-name>"
echo "- 检查网络: docker network ls"