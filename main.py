from typing import Union, List, Dict, Any
from fastapi import FastAPI, HTTPException
import asyncio
from contextlib import asynccontextmanager
from crawl4ai import *
from python.webCrawler import crawler_service
from pydantic import BaseModel



@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # 启动时初始化爬虫
    await crawler_service.initialize()
    yield
    # 关闭时清理爬虫
    await crawler_service.close()

app = FastAPI(lifespan=lifespan)

@app.get("/")
def read_root():
    return {"Hello": "World"}


@app.get("/items/{item_id}")
def read_item(item_id: int, q: Union[str, None] = None):
    return {"item_id": item_id, "q": q}

class HtmlRequest(BaseModel):
    html_str: str

@app.post("/tomd/html")
async def convert_html_to_markdown(request: HtmlRequest):
    """
    将HTML字符串转换为Markdown格式
    
    请求格式示例：
    POST /tomd/html
    Content-Type: application/json
    
    {
        "html_str": "<h1>Hello World</h1><p>This is a <strong>test</strong></p>"
    }
    
    成功响应示例：
    {
        "success": true,
        "markdown": "# Hello World\n\nThis is a **test**",
        "original_html": "<h1>Hello World</h1><p>This is a <strong>test</strong></p>"
    }
    
    错误响应示例：
    {
        "detail": "HTML字符串不能为空"
    }
    """
    html_str = request.html_str
    if not html_str:
        raise HTTPException(status_code=400, detail="HTML字符串不能为空")
    
    try:
        # 使用爬虫的HTML转Markdown功能
        crawler = crawler_service.get_crawler()
        result = await crawler.arun(html=html_str)
        return {
            "success": True,
            "markdown": result.markdown,
            "original_html": html_str[:200] + "..." if len(html_str) > 200 else html_str
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"转换失败: {str(e)}")

class UrlRequest(BaseModel):
    url: str



@app.post("/tomd/url")
async def convert_url_to_markdown(request: UrlRequest):
    """
    将指定URL的HTML内容转换为Markdown格式
    
    请求格式示例：
    POST /tomd/url
    Content-Type: application/json
    
    {
        "url": "https://example.com"
    }
    
    成功响应示例：
    {
        "success": true,
        "markdown": "# Example Domain\n\nThis domain is for use in illustrative examples...",
        "url": "https://example.com",
        "title": "Example Domain"
    }
    
    错误响应示例：
    {
        "detail": "URL不能为空"
    }
    """
    url = request.url
    if not url:
        raise HTTPException(status_code=400, detail="URL不能为空")
    
    try:
        # 使用爬虫抓取URL并转换为Markdown
        crawler = crawler_service.get_crawler()
        result = await crawler.arun(url=url)
        return {
            "success": True,
            "markdown": result.markdown,
            "url": url,
            "title": result.title if hasattr(result, 'title') else None
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"抓取和转换失败: {str(e)}")

class BatchRequest(BaseModel):
    items: List[str]

@app.post("/tomd/batch")
async def convert_batch_html_to_markdown(request: BatchRequest):
    """
    批量将HTML字符串转换为Markdown格式
    
    请求格式示例：
    POST /tomd/batch
    Content-Type: application/json
    
    {
        "items": [
            "<h1>HTML 1</h1><p>Content 1</p>",
            "<h2>HTML 2</h2><p>Content 2</p>",
            "<h3>HTML 3</h3><p>Content 3</p>"
        ]
    }
    
    成功响应示例：
    {
        "total_items": 3,
        "successful": 2,
        "failed": 1,
        "results": [
            {
                "index": 0,
                "success": true,
                "markdown": "# HTML 1\n\nContent 1"
            },
            {
                "index": 1,
                "success": true,
                "markdown": "## HTML 2\n\nContent 2"
            },
            {
                "index": 2,
                "success": false,
                "error": "转换失败: 网络错误"
            }
        ]
    }
    
    错误响应示例：
    {
        "detail": "参数必须是HTML字符串列表"
    }
    """
    items = request.items
    if not items or not isinstance(items, list):
        raise HTTPException(status_code=400, detail="参数必须是HTML字符串列表")
    
    results = []
    for i, html_str in enumerate(items):
        if not html_str:
            results.append({
                "index": i,
                "success": False,
                "error": "HTML字符串不能为空"
            })
            continue
            
        try:
            crawler = crawler_service.get_crawler()
            result = await crawler.arun(html=html_str)
            results.append({
                "index": i,
                "success": True,
                "markdown": result.markdown
            })
        except Exception as e:
            results.append({
                "index": i,
                "success": False,
                "error": str(e)
            })
    
    return {
        "total_items": len(items),
        "successful": sum(1 for r in results if r["success"]),
        "failed": sum(1 for r in results if not r["success"]),
        "results": results
    }

