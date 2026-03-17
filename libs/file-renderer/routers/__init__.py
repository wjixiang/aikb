"""
Routers package
"""

from routers.binary import router as binary_router
from routers.csv import router as csv_router
from routers.docling import router as docling_router
from routers.editor import router as editor_router
from routers.file import router as file_router
from routers.health import router as health_router
from routers.html import router as html_router
from routers.json import router as json_router
from routers.markdown import router as markdown_router
from routers.pdf import router as pdf_router
from routers.tex import router as tex_router
from routers.text import router as text_router
from routers.xml import router as xml_router

__all__ = [
    "file_router",
    "text_router",
    "json_router",
    "markdown_router",
    "html_router",
    "xml_router",
    "csv_router",
    "binary_router",
    "pdf_router",
    "tex_router",
    "docling_router",
    "editor_router",
    "health_router",
]
