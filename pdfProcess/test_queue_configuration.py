#!/usr/bin/env python3
"""
Test script to validate RabbitMQ queue configuration mismatch
"""

import pika
from config import Config
from logger import create_logger_with_prefix

logger = create_logger_with_prefix('QueueConfigTest')

def test_queue_declaration():
    """Test different queue declaration approaches"""
    
    try:
        connection = pika.BlockingConnection(
            pika.URLParameters(Config.RABBITMQ_URL)
        )
        channel = connection.channel()
        
        queue_name = 'pdf-splitting-request'
        
        print(f"=== Testing queue '{queue_name}' configuration ===\n")
        
        # 1. Test passive declaration (should work)
        print("1. Testing passive declaration (should work)...")
        try:
            result = channel.queue_declare(queue=queue_name, durable=True, passive=True)
            print(f"   ✅ Passive declaration successful, message count: {result.method.message_count}")
        except Exception as e:
            print(f"   ❌ Passive declaration failed: {e}")
        
        # 2. Test declaration without arguments (should fail)
        print("\n2. Testing declaration without arguments (should fail)...")
        try:
            result = channel.queue_declare(queue=queue_name, durable=True)
            print(f"   ✅ Declaration without arguments successful (unexpected!)")
        except Exception as e:
            print(f"   ❌ Declaration without arguments failed: {e}")
        
        # 3. Test declaration with correct arguments (should work)
        print("\n3. Testing declaration with correct arguments...")
        try:
            result = channel.queue_declare(
                queue=queue_name,
                durable=True,
                arguments={
                    'x-dead-letter-exchange': 'pdf-conversion-dlx',
                    'x-dead-letter-routing-key': 'pdf.conversion.dlq',
                    'x-message-ttl': 3600000,  # 1 hour in milliseconds
                    'x-max-length': 1000,  # Maximum 1,000 messages
                }
            )
            print(f"   ✅ Declaration with correct arguments successful")
        except Exception as e:
            print(f"   ❌ Declaration with correct arguments failed: {e}")
        
        # 4. Test declaration with wrong arguments (should fail)
        print("\n4. Testing declaration with wrong arguments...")
        try:
            result = channel.queue_declare(
                queue=queue_name,
                durable=True,
                arguments={
                    'x-message-ttl': 7200000,  # Different TTL
                }
            )
            print(f"   ✅ Declaration with wrong arguments successful (unexpected!)")
        except Exception as e:
            print(f"   ❌ Declaration with wrong arguments failed: {e}")
        
        connection.close()
        
    except Exception as e:
        print(f"❌ Connection failed: {e}")

if __name__ == "__main__":
    test_queue_declaration()