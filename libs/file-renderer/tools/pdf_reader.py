#!/usr/bin/env python
"""
PDF Reader CLI - 终端 PDF 阅读工具
"""

import argparse
import sys

import requests


def read_pdf(url: str, s3_key: str, page: int = 1, host: str = "http://localhost:8000"):
    """请求读取 PDF 指定页内容"""
    api_url = f"{host}/pdf/read"

    try:
        response = requests.post(
            api_url,
            json={"s3Key": s3_key, "page": page},
            timeout=30,
        )
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


def render_markdown(content: str, width: int = 80):
    """简单的终端 Markdown 渲染"""
    lines = content.split("\n")

    for line in lines:
        # 标题渲染
        if line.startswith("## "):
            print(f"\n\033[1;36m{line}\033[0m")
        elif line.startswith("# "):
            print(f"\n\033[1;33m{line}\033[0m\n")
        # 表格渲染（简化）
        elif "|" in line:
            print(f"\033[90m{line}\033[0m")
        # 粗体渲染
        elif "**" in line:
            line = line.replace("**", "\033[1m") + "\033[0m"
            print(line)
        # 普通文本
        else:
            print(line)


def main():
    parser = argparse.ArgumentParser(description="PDF Reader CLI - 终端 PDF 阅读工具")
    parser.add_argument("s3_key", help="S3 文件路径，如 /Diagnosis-and-Management-of-Hemodialysis-Access-Complications.pdf")
    parser.add_argument("-p", "--page", type=int, default=1, help="页码 (默认: 1)")
    parser.add_argument("--host", default="http://localhost:8000", help="API 主机地址 (默认: http://localhost:8000)")

    args = parser.parse_args()

    print(f"正在读取: {args.s3_key}")
    print(f"页码: {args.page}")
    print("-" * 40)

    result = read_pdf(args.host, args.s3_key, args.page)

    # 显示元数据
    meta = result["metadata"]
    print(f"文件: {meta['fileName']}")
    print(f"总页数: {meta['totalPage']}")
    print(f"当前页: {result['page']}")
    print("=" * 40)
    print()

    # 渲染内容
    render_markdown(result["content"])


if __name__ == "__main__":
    main()
