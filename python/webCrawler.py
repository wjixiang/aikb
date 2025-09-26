import asyncio
from crawl4ai import AsyncWebCrawler
from typing import Optional

class CrawlerService:
    _instance: Optional['CrawlerService'] = None
    _crawler: Optional[AsyncWebCrawler] = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    async def initialize(self):
        """在应用启动时初始化爬虫"""
        if self._crawler is None:
            self._crawler = AsyncWebCrawler()
            await self._crawler.__aenter__()
    
    async def close(self):
        """在应用关闭时清理爬虫"""
        if self._crawler is not None:
            await self._crawler.__aexit__(None, None, None)
            self._crawler = None
    
    def get_crawler(self) -> AsyncWebCrawler:
        """获取爬虫实例"""
        if self._crawler is None:
            raise RuntimeError("Crawler not initialized. Call initialize() first.")
        return self._crawler

# 创建全局服务实例
crawler_service = CrawlerService()
