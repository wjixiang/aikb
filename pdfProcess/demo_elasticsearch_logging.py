#!/usr/bin/env python3
"""
演示Python日志到Elasticsearch的完整功能
"""

import sys
import time
from pathlib import Path

# Add the current directory to the Python path
sys.path.insert(0, str(Path(__file__).parent))

from logger import create_logger_with_prefix
from config import Config


def main():
    """演示日志功能"""
    print("🚀 演示Python日志到Elasticsearch")
    print("=" * 50)
    
    # 显示配置
    es_config = Config.get_elasticsearch_config()
    print(f"📡 Elasticsearch启用: {es_config['enabled']}")
    print(f"📡 Elasticsearch URL: {es_config['url']}")
    print(f"📝 索引模式: {es_config['index_pattern']}")
    print(f"🔧 服务名称: {es_config['service_name']}")
    print()
    
    # 创建不同类型的日志器
    main_logger = create_logger_with_prefix('MainProcess')
    worker_logger = create_logger_with_prefix('WorkerProcess')
    error_logger = create_logger_with_prefix('ErrorProcessor')
    
    # 演示不同级别的日志
    print("📝 发送不同级别的日志...")
    main_logger.info("应用程序启动")
    worker_logger.info("Worker进程开始处理")
    
    # 演示带元数据的日志
    worker_logger.info(
        "处理PDF文件", 
        extra={'meta': {
            'file_name': 'document.pdf',
            'file_size': 1024000,
            'processing_time': 1500
        }}
    )
    
    # 演示警告日志
    worker_logger.warning(
        "处理时间较长",
        extra={'meta': {
            'file_name': 'large_document.pdf',
            'processing_time': 5000,
            'threshold': 3000
        }}
    )
    
    # 演示错误日志
    try:
        # 模拟一个错误
        raise ValueError("模拟的处理错误")
    except Exception as e:
        error_logger.error(
            "处理过程中发生错误",
            extra={'meta': {
                'error_type': type(e).__name__,
                'error_message': str(e),
                'file_name': 'corrupted.pdf'
            }},
            exc_info=True
        )
    
    # 演示完成日志
    main_logger.info("应用程序运行完成")
    
    print("\n⏳ 等待日志写入Elasticsearch...")
    time.sleep(3)
    
    print("\n✅ 演示完成！")
    print(f"📊 总共发送了5条不同类型的日志到Elasticsearch")
    print(f"🔍 可以在Kibana中查询服务名称: {es_config['service_name']}")
    
    # 显示查询示例
    print("\n📋 Kibana查询示例:")
    print(f'service:"{es_config["service_name"]}"')
    print('level:"error"')
    print('meta.file_name:"document.pdf"')


if __name__ == "__main__":
    main()