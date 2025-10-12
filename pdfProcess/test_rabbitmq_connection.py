#!/usr/bin/env python3
"""
Simple test script to verify RabbitMQ connection
"""

import sys
import os
import pika
from config import Config

def test_rabbitmq_connection():
    """Test basic RabbitMQ connection"""
    print("Testing RabbitMQ connection...")
    print(f"Host: {Config.RABBITMQ_HOST}")
    print(f"Port: {Config.RABBITMQ_PORT}")
    print(f"Username: {Config.RABBITMQ_USERNAME}")
    print(f"Virtual Host: {Config.RABBITMQ_VHOST}")
    print(f"URL: {Config.RABBITMQ_URL}")
    
    try:
        # Try to connect using URL
        print("\nAttempting connection with URL...")
        connection = pika.BlockingConnection(
            pika.URLParameters(Config.RABBITMQ_URL)
        )
        print("✅ Connection successful with URL!")
        connection.close()
        
        # Try to connect using parameters
        print("\nAttempting connection with parameters...")
        credentials = pika.PlainCredentials(
            Config.RABBITMQ_USERNAME, 
            Config.RABBITMQ_PASSWORD
        )
        parameters = pika.ConnectionParameters(
            host=Config.RABBITMQ_HOST,
            port=Config.RABBITMQ_PORT,
            virtual_host=Config.RABBITMQ_VHOST,
            credentials=credentials
        )
        connection = pika.BlockingConnection(parameters)
        print("✅ Connection successful with parameters!")
        connection.close()
        
        return True
        
    except Exception as e:
        print(f"❌ Connection failed: {e}")
        return False

def test_queue_access():
    """Test if we can access the PDF splitting queue"""
    print("\nTesting queue access...")
    
    try:
        connection = pika.BlockingConnection(
            pika.URLParameters(Config.RABBITMQ_URL)
        )
        channel = connection.channel()
        
        # Try to declare the queue
        queue_name = 'pdf-splitting-request'
        result = channel.queue_declare(
            queue=queue_name,
            durable=True,
            passive=True  # Just check if it exists
        )
        print(f"✅ Queue '{queue_name}' accessible, message count: {result.method.message_count}")
        
        connection.close()
        return True
        
    except pika.exceptions.ChannelClosedByBroker as e:
        if e.reply_code == 404:
            print(f"⚠️  Queue '{queue_name}' doesn't exist yet, but connection is working")
            return True
        else:
            print(f"❌ Queue access failed: {e}")
            return False
    except Exception as e:
        print(f"❌ Queue access failed: {e}")
        return False

if __name__ == "__main__":
    print("=== RabbitMQ Connection Test ===")
    
    connection_ok = test_rabbitmq_connection()
    
    if connection_ok:
        queue_ok = test_queue_access()
        if queue_ok:
            print("\n🎉 All tests passed! RabbitMQ is properly configured.")
            sys.exit(0)
        else:
            print("\n⚠️  Connection works but queue access failed.")
            sys.exit(1)
    else:
        print("\n❌ Connection test failed.")
        sys.exit(1)