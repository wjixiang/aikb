"""ukb-mcp CLI — 预热数据等离线工具。"""

from __future__ import annotations

import argparse
import sys
import time

from dotenv import load_dotenv

load_dotenv()

from dx_client import DXClient, DXClientConfig, DXConfigError
from ukb_mcp.config import get_settings


def cmd_warm(args: argparse.Namespace) -> None:
    """预热数据：连接 DNAnexus 并加载指定数据。"""
    settings = get_settings()

    client = DXClient(
        config=DXClientConfig(
            auth_token=settings.dx_auth_token,
            project_context_id=settings.dx_project_context_id,
            api_server_host=settings.dx_api_server_host,
            api_server_port=settings.dx_api_server_port,
            api_server_protocol=settings.dx_api_server_protocol,
        ),
    )

    try:
        client.connect()
    except DXConfigError as e:
        print(f"连接失败: {e}", file=sys.stderr)
        sys.exit(1)

    project = client.current_project_id or "(未设置)"
    print(f"已连接 DNAnexus  项目: {project}")
    print()

    targets = set(args.targets) if args.targets else {"fields"}

    if "fields" in targets:
        print("加载数据字典...")
        t0 = time.time()
        try:
            df = client.get_data_dictionary()
            elapsed = time.time() - t0
            print(f"  完成: {len(df)} 个字段  ({elapsed:.1f}s)")
        except Exception as e:
            print(f"  失败: {e}", file=sys.stderr)

    if "schema" in targets:
        print("加载数据库 schema...")
        t0 = time.time()
        try:
            db = client.find_database()
            tables = client.get_database_schema(db.id)
            elapsed = time.time() - t0
            print(f"  完成: {len(tables)} 张表  ({elapsed:.1f}s)")
        except Exception as e:
            print(f"  失败: {e}", file=sys.stderr)

    if "databases" in targets:
        print("加载数据库列表...")
        t0 = time.time()
        try:
            dbs = client.list_databases()
            elapsed = time.time() - t0
            print(f"  完成: {len(dbs)} 个数据库  ({elapsed:.1f}s)")
        except Exception as e:
            print(f"  失败: {e}", file=sys.stderr)

    if "all" in targets:
        print("加载项目文件列表...")
        t0 = time.time()
        try:
            files = client.list_files(limit=1000)
            elapsed = time.time() - t0
            print(f"  完成: {len(files)} 个文件  ({elapsed:.1f}s)")
        except Exception as e:
            print(f"  失败: {e}", file=sys.stderr)

    print()
    client.disconnect()


def main() -> None:
    parser = argparse.ArgumentParser(
        prog="ukb-mcp",
        description="UK Biobank 数据服务 CLI",
    )
    sub = parser.add_subparsers(dest="command")

    p_warm = sub.add_parser("warm", help="预热数据")
    p_warm.add_argument(
        "targets",
        nargs="*",
        choices=["fields", "schema", "databases", "all"],
        default=["fields"],
        help="预热目标，默认 fields。可多选。",
    )

    args = parser.parse_args()
    if args.command == "warm":
        cmd_warm(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
