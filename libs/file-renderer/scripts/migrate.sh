#!/bin/bash
# =============================================================================
# File Renderer Service 数据库迁移脚本
# =============================================================================
# 用法: ./scripts/migrate.sh [命令] [参数]
#
# 命令:
#   upgrade              升级到最新版本 (默认)
#   downgrade [步数]     降级指定步数 (默认 1)
#   revision [消息]      创建新迁移
#   history              查看迁移历史
#   current              查看当前版本
#   stamp [版本]         标记到指定版本（不执行 SQL）
#   check                检查是否有未应用的迁移
#   reset                重置数据库（危险！删除所有数据）
#
# 示例:
#   ./scripts/migrate.sh upgrade
#   ./scripts/migrate.sh downgrade 2
#   ./scripts/migrate.sh revision "添加用户表"
#   ./scripts/migrate.sh history
# =============================================================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# 默认命令
COMMAND="${1:-upgrade}"

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

log_step() {
    echo -e "${CYAN}[STEP]${NC} $1"
}

# 检查环境
check_environment() {
    cd "$PROJECT_DIR"

    # 检查 .env 文件
    if [ ! -f ".env" ]; then
        log_error ".env 文件不存在"
        exit 1
    fi

    # 加载环境变量
    export $(grep -v '^#' .env | xargs)

    # 检查虚拟环境
    if [ ! -d ".venv" ]; then
        log_error "虚拟环境不存在，请先运行: uv sync"
        exit 1
    fi

    # 检查 alembic
    if [ ! -f ".venv/bin/alembic" ] && [ ! -f ".venv/bin/uv" ]; then
        log_error "alembic 未安装"
        exit 1
    fi
}

# 运行 alembic 命令
run_alembic() {
    local args="$*"

    if [ -f ".venv/bin/uv" ]; then
        uv run alembic $args
    else
        .venv/bin/alembic $args
    fi
}

# 升级到最新版本
cmd_upgrade() {
    log_step "升级数据库到最新版本..."
    run_alembic upgrade head
    log_success "数据库已升级到最新版本"
}

# 降级
cmd_downgrade() {
    local steps="${1:-1}"
    log_step "降级数据库 $steps 个版本..."
    run_alembic downgrade -$steps
    log_success "数据库已降级 $steps 个版本"
}

# 创建新迁移
cmd_revision() {
    local message="${1:-auto}"
    log_step "创建新迁移: $message..."

    # 检查是否有模型变更
    log_info "检查模型变更..."

    run_alembic revision --autogenerate -m "$message"
    log_success "迁移创建成功"

    # 显示生成的迁移文件
    local latest_migration
    latest_migration=$(ls -t alembic/versions/*.py | head -1)
    log_info "生成的迁移文件: $latest_migration"

    # 提示用户检查迁移脚本
    log_warning "请检查生成的迁移脚本是否正确"
    echo ""
    head -50 "$latest_migration"
    echo ""
    log_info "确认无误后运行: $0 upgrade"
}

# 查看迁移历史
cmd_history() {
    log_step "迁移历史:"
    run_alembic history --verbose
}

# 查看当前版本
cmd_current() {
    log_step "当前版本:"
    run_alembic current
}

# 标记到指定版本
cmd_stamp() {
    local revision="${1:-head}"
    log_step "标记到版本: $revision..."
    run_alembic stamp $revision
    log_success "已标记到版本: $revision"
}

# 检查未应用的迁移
cmd_check() {
    log_step "检查未应用的迁移..."

    # 获取当前版本
    local current
    current=$(run_alembic current 2>&1 | grep -oP '[a-f0-9]+(?= \()' || echo "")

    # 获取最新版本
    local latest
    latest=$(run_alembic history 2>&1 | head -1 | grep -oP '^[a-f0-9]+' || echo "")

    if [ "$current" = "$latest" ]; then
        log_success "数据库已是最新版本"
    else
        log_warning "有未应用的迁移"
        log_info "当前版本: ${current:-none}"
        log_info "最新版本: $latest"
        log_info "运行 '$0 upgrade' 应用迁移"
    fi
}

# 重置数据库（危险！）
cmd_reset() {
    log_error "警告: 这将删除所有数据！"
    read -p "确定要重置数据库吗？输入 'RESET' 确认: " confirm

    if [ "$confirm" != "RESET" ]; then
        log_info "操作已取消"
        exit 0
    fi

    log_step "重置数据库..."

    # 降级到基础版本
    run_alembic downgrade base

    # 删除所有迁移文件
    log_warning "删除迁移文件..."
    rm -f alembic/versions/*.py

    # 重新创建初始迁移
    run_alembic revision --autogenerate -m "initial migration"

    # 升级
    run_alembic upgrade head

    log_success "数据库已重置"
}

# 显示帮助
show_help() {
    cat << EOF
File Renderer Service 数据库迁移脚本

用法: $0 [命令] [参数]

命令:
  upgrade [版本]       升级到指定版本（默认最新）
  downgrade [步数]     降级指定步数（默认 1）
  revision [消息]      创建新迁移（自动生成）
  history              查看迁移历史
  current              查看当前版本
  stamp [版本]         标记到指定版本（不执行 SQL）
  check                检查是否有未应用的迁移
  reset                重置数据库（危险！删除所有数据）
  help                 显示此帮助

示例:
  $0 upgrade                    # 升级到最新版本
  $0 upgrade ae1027a6acf        # 升级到指定版本
  $0 downgrade                  # 降级 1 个版本
  $0 downgrade 3                # 降级 3 个版本
  $0 revision "添加用户表"       # 创建新迁移
  $0 history                    # 查看迁移历史
  $0 current                    # 查看当前版本
  $0 stamp head                 # 标记为最新版本
  $0 check                      # 检查未应用的迁移

EOF
}

# 主函数
main() {
    log_info "======================================"
    log_info "File Renderer Service 数据库迁移"
    log_info "======================================"

    # 检查环境
    check_environment

    # 执行命令
    case "$COMMAND" in
        upgrade|up)
            cmd_upgrade
            ;;
        downgrade|down)
            cmd_downgrade "$2"
            ;;
        revision|rev|migrate)
            cmd_revision "$2"
            ;;
        history|hist|log)
            cmd_history
            ;;
        current|curr)
            cmd_current
            ;;
        stamp)
            cmd_stamp "$2"
            ;;
        check)
            cmd_check
            ;;
        reset|clean)
            cmd_reset
            ;;
        help|-h|--help)
            show_help
            ;;
        *)
            log_error "未知命令: $COMMAND"
            show_help
            exit 1
            ;;
    esac
}

# 运行主函数
main "$@"
