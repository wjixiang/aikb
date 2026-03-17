#!/bin/bash
# =============================================================================
# File Renderer Service 健康检查脚本
# =============================================================================
# 用法: ./scripts/health-check.sh [选项]
#
# 选项:
#   -h, --help          显示帮助
#   -u, --url URL       指定服务 URL (默认: http://localhost:8000)
#   -t, --timeout SEC   超时时间 (默认: 10)
#   -v, --verbose       详细输出
#   --db-only           仅检查数据库
#   --s3-only           仅检查 S3
#   --full              完整检查（包括依赖服务）
#
# 示例:
#   ./scripts/health-check.sh
#   ./scripts/health-check.sh -u http://api.example.com
#   ./scripts/health-check.sh --full
# =============================================================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 默认配置
BASE_URL="http://localhost:8000"
TIMEOUT=10
VERBOSE=false
CHECK_DB=false
CHECK_S3=false
CHECK_FULL=false

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
    echo -e "${CYAN}[CHECK]${NC} $1"
}

# 解析参数
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_help
                exit 0
                ;;
            -u|--url)
                BASE_URL="$2"
                shift 2
                ;;
            -t|--timeout)
                TIMEOUT="$2"
                shift 2
                ;;
            -v|--verbose)
                VERBOSE=true
                shift
                ;;
            --db-only)
                CHECK_DB=true
                shift
                ;;
            --s3-only)
                CHECK_S3=true
                shift
                ;;
            --full)
                CHECK_FULL=true
                shift
                ;;
            *)
                log_error "未知选项: $1"
                show_help
                exit 1
                ;;
        esac
    done
}

# 显示帮助
show_help() {
    cat << EOF
File Renderer Service 健康检查脚本

用法: $0 [选项]

选项:
  -h, --help          显示此帮助
  -u, --url URL       指定服务 URL (默认: http://localhost:8000)
  -t, --timeout SEC   超时时间，单位秒 (默认: 10)
  -v, --verbose       详细输出
  --db-only           仅检查数据库连接
  --s3-only           仅检查 S3 连接
  --full              完整检查（包括所有依赖）

示例:
  $0                          # 基础健康检查
  $0 -u http://api.example.com  # 检查指定 URL
  $0 --full                   # 完整检查
  $0 --db-only                # 仅检查数据库
  $0 -v                       # 详细输出

退出码:
  0  所有检查通过
  1  有检查项失败

EOF
}

# HTTP 请求函数
http_get() {
    local url="$1"
    local response
    local http_code

    if command -v curl >/dev/null 2>&1; then
        response=$(curl -s -w "\n%{http_code}" --max-time "$TIMEOUT" "$url" 2>&1)
        http_code=$(echo "$response" | tail -n1)
        body=$(echo "$response" | sed '$d')
    elif command -v wget >/dev/null 2>&1; then
        response=$(wget -q -O - --timeout="$TIMEOUT" --server-response "$url" 2>&1)
        http_code=$(echo "$response" | grep "HTTP/" | tail -1 | awk '{print $2}')
        body=$(echo "$response" | sed -n '/^$/,$p' | tail -n +2)
    else
        log_error "需要 curl 或 wget"
        return 1
    fi

    if [ "$http_code" = "200" ]; then
        echo "$body"
        return 0
    else
        return 1
    fi
}

# 检查基础健康
check_basic() {
    log_step "检查服务基础健康..."

    local response
    if response=$(http_get "$BASE_URL/health"); then
        if [ "$VERBOSE" = true ]; then
            log_info "响应: $response"
        fi
        log_success "服务运行正常"
        return 0
    else
        log_error "服务健康检查失败"
        return 1
    fi
}

# 检查根端点
check_root() {
    log_step "检查服务根端点..."

    local response
    if response=$(http_get "$BASE_URL/"); then
        if [ "$VERBOSE" = true ]; then
            local name version
            name=$(echo "$response" | grep -o '"name":"[^"]*"' | cut -d'"' -f4)
            version=$(echo "$response" | grep -o '"version":"[^"]*"' | cut -d'"' -f4)
            log_info "服务: $name v$version"
        fi
        log_success "根端点正常"
        return 0
    else
        log_error "根端点检查失败"
        return 1
    fi
}

# 检查数据库
check_database() {
    log_step "检查数据库连接..."

    local response
    if response=$(http_get "$BASE_URL/health/db"); then
        if [ "$VERBOSE" = true ]; then
            log_info "响应: $response"
        fi
        log_success "数据库连接正常"
        return 0
    else
        log_error "数据库连接失败"
        return 1
    fi
}

# 检查 S3
check_s3() {
    log_step "检查 S3 连接..."

    local response
    if response=$(http_get "$BASE_URL/health/s3"); then
        if [ "$VERBOSE" = true ]; then
            log_info "响应: $response"
        fi
        log_success "S3 连接正常"
        return 0
    else
        log_error "S3 连接失败"
        return 1
    fi
}

# 检查 API 文档
check_docs() {
    log_step "检查 API 文档..."

    local docs_ok=true

    # 检查 Swagger UI
    if http_get "$BASE_URL/docs" >/dev/null 2>&1; then
        log_success "Swagger UI 可访问"
    else
        log_warning "Swagger UI 不可访问"
        docs_ok=false
    fi

    # 检查 OpenAPI schema
    if http_get "$BASE_URL/openapi.json" >/dev/null 2>&1; then
        log_success "OpenAPI Schema 可访问"
    else
        log_warning "OpenAPI Schema 不可访问"
        docs_ok=false
    fi

    $docs_ok
    return
}

# 检查响应时间
check_response_time() {
    log_step "检查响应时间..."

    local start_time end_time duration
    start_time=$(date +%s%N)

    if http_get "$BASE_URL/health" >/dev/null 2>&1; then
        end_time=$(date +%s%N)
        duration=$(( (end_time - start_time) / 1000000 ))  # 转换为毫秒

        if [ "$VERBOSE" = true ]; then
            log_info "响应时间: ${duration}ms"
        fi

        if [ "$duration" -lt 1000 ]; then
            log_success "响应时间正常 (${duration}ms)"
            return 0
        else
            log_warning "响应时间较长 (${duration}ms)"
            return 1
        fi
    else
        log_error "无法测量响应时间"
        return 1
    fi
}

# 检查磁盘空间
check_disk_space() {
    log_step "检查磁盘空间..."

    # 获取脚本所在目录
    local script_dir project_dir
    script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    project_dir="$(dirname "$script_dir")"

    local usage
    usage=$(df "$project_dir" | awk 'NR==2 {print $5}' | sed 's/%//')

    if [ "$VERBOSE" = true ]; then
        log_info "磁盘使用率: ${usage}%"
    fi

    if [ "$usage" -lt 80 ]; then
        log_success "磁盘空间充足 (${usage}%)"
        return 0
    elif [ "$usage" -lt 90 ]; then
        log_warning "磁盘空间不足 (${usage}%)"
        return 1
    else
        log_error "磁盘空间严重不足 (${usage}%)"
        return 1
    fi
}

# 检查内存使用
check_memory() {
    log_step "检查内存使用..."

    if command -v free >/dev/null 2>&1; then
        local mem_usage
        mem_usage=$(free | grep Mem | awk '{printf "%.0f", $3/$2 * 100.0}')

        if [ "$VERBOSE" = true ]; then
            log_info "内存使用率: ${mem_usage}%"
        fi

        if [ "$mem_usage" -lt 80 ]; then
            log_success "内存使用正常 (${mem_usage}%)"
            return 0
        else
            log_warning "内存使用率较高 (${mem_usage}%)"
            return 1
        fi
    else
        log_warning "无法检查内存使用"
        return 1
    fi
}

# 主函数
main() {
    parse_args "$@"

    log_info "======================================"
    log_info "File Renderer Service 健康检查"
    log_info "URL: $BASE_URL"
    log_info "======================================"

    local exit_code=0

    # 根据检查类型执行不同检查
    if [ "$CHECK_DB" = true ]; then
        check_database || exit_code=1
    elif [ "$CHECK_S3" = true ]; then
        check_s3 || exit_code=1
    elif [ "$CHECK_FULL" = true ]; then
        # 完整检查
        check_root || exit_code=1
        check_basic || exit_code=1
        check_database || exit_code=1
        check_s3 || exit_code=1
        check_docs || true  # 文档检查失败不影响整体状态
        check_response_time || exit_code=1
        check_disk_space || exit_code=1
        check_memory || exit_code=1
    else
        # 基础检查
        check_root || exit_code=1
        check_basic || exit_code=1
    fi

    echo ""
    log_info "======================================"
    if [ $exit_code -eq 0 ]; then
        log_success "所有检查通过"
    else
        log_error "部分检查失败"
    fi
    log_info "======================================"

    exit $exit_code
}

# 运行主函数
main "$@"
