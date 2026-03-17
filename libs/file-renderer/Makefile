# File Renderer Service Makefile
# 代码质量、测试和开发任务

.PHONY: help install install-dev format lint type-check test test-cov check clean db-upgrade db-downgrade db-revision db-reset

# 默认目标
help:
	@echo "Available commands:"
	@echo "  install      - Install production dependencies"
	@echo "  install-dev  - Install development dependencies"
	@echo "  format       - Format code with black"
	@echo "  format-check - Check code formatting with black"
	@echo "  lint         - Run ruff linter"
	@echo "  lint-fix     - Run ruff linter with auto-fix"
	@echo "  type-check   - Run mypy type checker"
	@echo "  test         - Run pytest"
	@echo "  test-cov     - Run pytest with coverage"
	@echo "  check        - Run all checks (format-check, lint, type-check)"
	@echo "  fix          - Run all auto-fixes (format, lint-fix)"
	@echo "  clean        - Clean cache files"
	@echo ""
	@echo "Database migration commands:"
	@echo "  db-upgrade   - Upgrade database to latest migration"
	@echo "  db-downgrade - Downgrade database one revision"
	@echo "  db-revision  - Create new migration revision (auto-generate)"
	@echo "  db-reset     - Reset database (drop and recreate all tables)"
	@echo "  db-history   - Show migration history"
	@echo "  db-current   - Show current migration"

# 安装依赖
install:
	uv pip install -e .

install-dev:
	uv pip install -e ".[dev]"

# 代码格式化
format:
	@echo "Running black..."
	black .

format-check:
	@echo "Checking code formatting..."
	black --check .

# 代码检查
lint:
	@echo "Running ruff..."
	ruff check .

lint-fix:
	@echo "Running ruff with auto-fix..."
	ruff check --fix .

# 类型检查
type-check:
	@echo "Running mypy..."
	mypy .

# 测试
test:
	@echo "Running tests..."
	pytest

test-cov:
	@echo "Running tests with coverage..."
	pytest --cov=. --cov-report=term-missing --cov-report=html

# 综合检查
check: format-check lint type-check
	@echo "All checks passed!"

fix: format lint-fix
	@echo "All fixes applied!"

# 清理
clean:
	@echo "Cleaning cache files..."
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete 2>/dev/null || true
	find . -type f -name "*.pyo" -delete 2>/dev/null || true
	find . -type d -name "*.egg-info" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name ".pytest_cache" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name ".mypy_cache" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name "htmlcov" -exec rm -rf {} + 2>/dev/null || true
	@echo "Clean complete!"

# 开发服务器
dev:
	uvicorn main:app --reload --host 0.0.0.0 --port 8000

run:
	python main.py

# 数据库迁移命令
db-upgrade:
	@echo "Running database upgrade..."
	./scripts/db_upgrade.sh

db-downgrade:
	@echo "Running database downgrade..."
	./scripts/db_downgrade.sh

db-revision:
	@echo "Creating new migration revision..."
	@read -p "Enter migration message: " msg; \
	./scripts/db_revision.sh "$$msg" --autogenerate

db-reset:
	@echo "Resetting database..."
	./scripts/db_reset.sh

db-history:
	@echo "Showing migration history..."
	alembic history --verbose

db-current:
	@echo "Showing current migration..."
	alembic current
