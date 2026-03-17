#!/bin/bash
# =============================================================================
# File Renderer Service 启动脚本
# =============================================================================
# 用法: ./scripts/start.sh [环境]
#   环境: development | production (默认: production)
#
# 示例:
#   ./scripts/start.sh              # 生产环境启动
#   ./scripts/start.sh development  # 开发环境启动
# =============================================================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# 默认环境
ENVIRONMENT="${1:-production}"

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查命令是否存在
check_command() {
    if ! command -v "$1" &>/dev/null; then
        log_error "$1 未安装，请先安装"
        exit 1
    fi
}

# 检查环境变量文件
check_env_file() {
    if [ ! -f "$PROJECT_DIR/.env" ]; then
        if [ -f "$PROJECT_DIR/.env.example" ]; then
            log_warning ".env 文件不存在，从 .env.example 复制"
            cp "$PROJECT_DIR/.env.example" "$PROJECT_DIR/.env"
            log_info "请编辑 .env 文件配置实际参数"
        else
            log_error ".env 和 .env.example 文件都不存在"
            exit 1
        fi
    fi
}

# 检查 Python 版本
check_python_version() {
    local python_version
    python_version=$(python3 --version 2>&1 | awk '{print $2}')
    local required_version="3.13"

    if [ "$(printf '%s\n' "$required_version" "$python_version" | sort -V | head -n1)" != "$required_version" ]; then
        log_error "Python 版本需要 >= 3.13，当前版本: $python_version"
        exit 1
    fi
    log_info "Python 版本: $python_version"
}

# 检查数据库连接
check_database() {
    log_info "检查数据库连接..."

    # 加载环境变量
    export $(grep -v '^#' "$PROJECT_DIR/.env" | xargs)

    # 提取数据库连接信息
    local db_host db_port
    db_host=$(echo "$DATABASE_URL" | sed -n 's/.*@\([^:]*\):.*/\1/p')
    db_port=$(echo "$DATABASE_URL" | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
    db_port=${db_port:-5432}

    if command -v pg_isready &>/dev/null; then
        if pg_isready -h "$db_host" -p "$db_port" >/devdev/null 2>&1; then
            log_success "数据库连接正常"
        else
            log_warning "数据库连接失败，请检查数据库服务是否运行"
            return 1
        fi
    else
        log_warning "pg_isready 未安装，跳过数据库连接检查"
    fi
}

# 检查 S3 连接
check_s3() {
    log_info "检查 S3 连接..."

    # 这里可以添加 S3 连接检查逻辑
    # 例如使用 aws cli 或 boto3 脚本检查
    log_info "S3 连接检查跳过（运行时检查）"
}

# 运行数据库迁移
run_migrations() {
    log_info "运行数据库迁移..."
    cd "$PROJECT_DIR"

    if [ -f "$PROJECT_DIR/.venv/bin/uv" ]; then
        uv run alembic upgrade head
    elif [ -f "$PROJECT_DIR/.venv/bin/alembic" ]; then
        "$PROJECT_DIR/.venv/bin/alembic" upgrade head
    else
        log_warning "未找到 alembic，跳过迁移"
        return 1
    fi

    log_success "数据库迁移完成"
}

# 启动开发服务器
start_development() {
    log_info "启动开发服务器..."
    cd "$PROJECT_DIR"

    export SERVER_RELOAD=true
    export SERVER_LOG_LEVEL=debug
    export DEBUG=true

    if [ -f "$PROJECT_DIR/.venv/bin/uv" ]; then
        exec uv run python -m uvicorn main:app \
            --host "${SERVER_HOST:-0.0.0.0}" \
            --port "${SERVER_PORT:-8000}" \
            --reload \
            --log-level debug
    else
        exec python3 -m uvicorn main:app \
            --host "${SERVER_HOST:-0.0.0.0}" \
            --port "${SERVER_PORT:-8000}" \
            --reload \
            --log-level debug
    fi
}

# 启动生产服务器
start_production() {
    log_info "启动生产服务器..."
    cd "$PROJECT_DIR"

    # 计算工作进程数
    local workers
    workers=$(python3 -c "import os; print(os.cpu_count() * 2 + 1)")
    log_info "工作进程数: $workers"

    if [ -f "$PROJECT_DIR/.venv/bin/uv" ]; then
        exec uv run python -m uvicorn main:app \
            --host "${SERVER_HOST:-0.0.0.0}" \
            --port "${SERVER_PORT:-8000}" \
            --workers "$workers" \
            --log-level "${SERVER_LOG_LEVEL:-info}"
    else
        exec python3 -m uvicorn main:app \
            --host "${SERVER_HOST:-0.0.0.0}" \
            --port "${SERVER_PORT:-8000}" \
            --workers "$workers" \
            --log-level "${SERVER_LOG_LEVEL:-info}"
    fi
}

# 主函数
main() {
    log_info "======================================"
    log_info "File Renderer Service 启动脚本"
    log_info "环境: $ENVIRONMENT"
    log_info "======================================"

    # 检查依赖
    check_command python3
    check_command curl
    check_env_file

    # 检查 Python 版本
    check_python_version

    # 检查虚拟环境
    if [ ! -d "$PROJECT_DIR/.venv" ]; then
        log_warning "虚拟环境不存在，请先运行: uv sync"
        exit 1
    fi

    # 检查数据库和 S3
    check_database || true
    check_s3 || true

    # 运行迁移
    run_migrations || true

    # 根据环境启动
    case "$ENVIRONMENT" in
        development|dev)
            start_development
            ;;
        production|prod)
            start_production
            ;;
        *)
            log_error "未知环境: $ENVIRONMENT"
            log_info "用法: $0 [development|production]"
            exit 1
            ;;
    esac
}

# 信号处理
cleanup() {
    log_info "正在关闭服务..."
    exit 0
}

trap cleanup SIGINT SIGTERM

# 运行主函数
main "$@"
