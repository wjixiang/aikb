# Medical Review Skill v4.3

[![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/downloads/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![R Integration](https://img.shields.io/badge/R-IPDfromKM-green.svg)](https://github.com/tgerke/IPDfromKM)

Medical Review Skill v4.3 是一个四层 AI 提取与证据硬化引擎，专门用于从医学文献 PDF 中提取结构化数据并生成符合 Nature Reviews 标准的综述内容。

> 🚀 **新手？** 查看 [新手指南](docs/newbie_guide.md) 或下方的 [快速开始](#快速开始)

## 核心特性

- **四层处理架构**: 智能解析 → 双 Agent 提取 → 一致性检查 → 引用硬化 → 人工审核
- **OneClickNatureReviewOrchestrator**: 一键式 Nature Reviews 综述生成编排器
- **Layer 4 人工审核系统**: 支持自动审核规则和人工审核模式，完整的审核记录和回调机制 (v4.3+)
- **IVDH 专业化分析**: MRI 影像分级 (Pfirrmann/Modic)、多组学数据提取、临床一致性验证
- **Cancer Cell 风格图表**: 通过 R 服务生成专业级 UMAP 和细胞比例图

## v4.3 版本亮点

### 🔧 架构优化
- **模型拆分**: `extraction_models.py` (1774行) 拆分为3个专注的子模块
- **异步优化**: 修复多个缓存模块的事件循环问题
- **配置化**: 硬编码值提取到配置文件，支持自定义默认值
- **代码重构**: 消除约400行重复代码，提取公共基类

### 🧪 测试与质量
- **性能基准测试**: 新增 Layer 性能测试和内存使用测试
- **测试开发指南**: 完整的测试编写规范和最佳实践文档
- **测试覆盖**: 测试用例从 145 增加到 212+

### 🚀 功能增强
- **Layer 4 完整实现**: 从 placeholder 升级为完整的人工审核系统
- **IVDH 专业化模块**: 针对腰椎间盘突出的 MRI 影像分析和多组学数据提取
- **智能 PDF 解析**: 章节语义路由 (SemanticSectionRouter) 和大表格优化 (OmicsTableOptimizer)
- **向后兼容**: 所有重构保持100%向后兼容

查看 [完整修复报告](.serena/memories/medical_review_v43/audit_fixes_completion.md)
- **GAP Score N-GSR 生物力学引擎**: 基于 Yilgor GAP Score 的脊柱矢状位平衡风险分析
- **几何恒等式校验**: PI = PT + SS 等生物力学完整性验证
- **双 Agent 机制**: 两个独立 AI Agent 提取，裁决者合并结果，提高准确性
- **三层一致性检查**: 语义、数值、引用一致性验证
- **引用硬化**: 指纹生成与验证，确保每个数据点可追溯
- **证据权重计算**: 基于影响因子和样本量的权重分析
- **孤证率分析**: 识别临床证据分歧 (Isolation Rate Analysis)
- **敏感性分析**: 留一法 (LOO) 稳健性评估
- **森林图生成**: 通过 R 服务生成专业森林图
- **人工审核界面**: 交互式审核，支持冲突解决
- **多图表支持**: 支持多图表文档的批量处理
- **优雅降级容错**: 智能容错调度引擎，确保流程稳定性

## 快速开始

### 安装

```bash
# 克隆仓库
git clone https://github.com/medical-review/skill-v43.git
cd medical_review_skill_v4.3

# 创建虚拟环境
python -m venv .venv
source .venv/bin/activate  # Linux/macOS
# 或 .venv\Scripts\activate  # Windows

# 安装依赖
pip install -r requirements.txt
pip install -e .

# 验证安装
python -c "from src.pipeline import ProcessingPipeline; print('Medical Review Skill v4.3 安装成功')"
python -c "import src; print(f'版本: {src.__version__}')"  # 如果定义了 __version__
```

### 配置

#### 1. 设置 API 密钥 (支持多厂商)

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑 .env 文件，填入你的 API 密钥
# 支持以下任一或多个提供商：
export ANTHROPIC_API_KEY="your-api-key"
export OPENAI_API_KEY="your-api-key"
export OPENROUTER_API_KEY="your-api-key"
export VOLCENGINE_API_KEY="your-api-key"    # 火山引擎
export KIMI_API_KEY="your-api-key"          # Moonshot
export GLM_API_KEY="your-api-key"           # Z.AI
export MINIMAX_API_KEY="your-api-key"       # MiniMax
export SILICONFLOW_API_KEY="your-api-key"   # 硅基流动
```

#### 2. 创建配置文件

```bash
# 配置文件已存在于 configs/config.yaml
# 根据需求修改配置即可
```

编辑 `configs/config.yaml`：

```yaml
# Agent A 配置 (例如：火山引擎 DeepSeek)
agent_a_model:
  provider: volcengine
  name: deepseek-r1
  temperature: 0.0

# Agent B 配置 (例如：Kimi)
agent_b_model:
  provider: kimi
  name: kimi-latest
  temperature: 0.0

# 输出配置
output_dir: "./outputs"
```

### 使用示例

#### 命令行使用 (推荐)

**基础用法：**
```bash
# 处理单个文档
python main.py process doc.pdf --output ./my_review

# 批量处理文档
python main.py batch doc1.pdf doc2.pdf doc3.pdf --output ./my_review

# 处理整个目录
python main.py directory ./papers --output ./my_review --pattern "*.pdf"

# 高级配置：禁用特定功能
python main.py batch *.pdf --no-gap-analysis --no-forest-plot --verbose

# 显示统计信息
python main.py stats --output ./my_review

# 管理缓存
python main.py cache --stats
python main.py cache --clear
python main.py cache --cleanup

# 验证处理结果
python main.py validate results/paper_result.json

# 配置管理
python main.py config
python main.py config --set parser_dpi --value 300
```

**IVDH 专业化分析（v4.3+）：**

```bash
# 启用 IVDH MRI 分析（提取 Pfirrmann 分级、Modic 改变、疝出类型）
python main.py batch data/ivdh_papers/*.pdf --enable-ivdh-mri --output ./outputs

# 启用 Multi-Omics 分析（提取 scRNA-seq/bulk RNA-seq 数据）
python main.py batch data/omics_papers/*.pdf --enable-multi-omics --output ./outputs

# 组合使用 IVDH MRI + Multi-Omics
python main.py batch data/papers/*.pdf \
    --enable-ivdh-mri \
    --enable-multi-omics \
    --max-concurrent 2 \
    --output ./outputs

# 启动 Layer 4 审核界面
python main.py ui --port 8080
```

**自动化功能（v4.3+）：**

```bash
# R 服务自动管理（默认自动启动/停止）
python main.py process doc.pdf

# 使用外部 R 服务
python main.py process doc.pdf --no-manage-r-service

# Layer 4 审核模式
python main.py process doc.pdf --layer4-mode auto        # 自动规则验证
python main.py process doc.pdf --layer4-mode deferred    # 生成审核任务

# 启动 Web UI 进行人工审核
python scripts/start_layer4_ui.py

# Docker 环境管理
python scripts/docker_manage.py up
python scripts/docker_manage.py logs -f
python scripts/docker_manage.py down
```

**向量数据库配置（Layer 3 引用硬化）：**

```bash
# 方式 1: 命令行参数（临时）
# 使用 Qdrant（高性能，需 Docker）
python main.py process doc.pdf \
    --vector-store qdrant \
    --embedding-provider openai \
    --similarity-threshold 0.85

# 使用 Chroma（免费本地）
python main.py process doc.pdf \
    --vector-store chroma \
    --embedding-provider openrouter \
    --embedding-model openai/text-embedding-3-small

# 方式 2: 环境变量（推荐）
export VECTOR_STORE_PROVIDER=qdrant
export EMBEDDING_PROVIDER=openai
export OPENAI_API_KEY=sk-xxxx

python main.py process doc.pdf

# 方式 3: 配置文件（持久化）
# 编辑 configs/config.yaml，然后直接运行
python main.py process doc.pdf
```

**启动向量数据库：**
```bash
# Qdrant (Docker)
docker run -d -p 6333:6333 qdrant/qdrant

# Chroma (纯 Python，无需额外服务)
# 数据自动保存在 ./data/vector_db
```

#### Python API 使用

```python
import asyncio
from src.pipeline import ProcessingPipeline

async def main():
    # 创建 ProcessingPipeline
    pipeline = ProcessingPipeline()

    # 处理文档
    result = await pipeline.process("paper.pdf")

    # 查看结果
    print(f"状态: {result.status}")
    print(f"提取数据点: {len(result.data_points)}")

    # 输出数据点
    for dp in result.data_points:
        print(f"- {dp.claim} (置信度: {dp.confidence:.2f})")

# 运行
asyncio.run(main())
```

#### OneClickNatureReviewOrchestrator 高级用法

```python
import asyncio
from src.pipeline import (
    OneClickNatureReviewOrchestrator,
    OrchestratorConfig,
)

async def main():
    # 创建编排器
    orchestrator = OneClickNatureReviewOrchestrator(
        output_dir="./outputs",
        config=OrchestratorConfig(
            enable_gap_analysis=True,
            enable_sensitivity_analysis=True,
            enable_forest_plot=True,
            enable_ivdh_mri_analysis=True,      # 启用 IVDH MRI 分析
            enable_multi_omics=True,             # 启用多组学分析
        )
    )
    
    # 批量处理
    result = await orchestrator.process_batch(
        ["doc1.pdf", "doc2.pdf", "doc3.pdf"],
        progress_callback=lambda msg, p: print(f"{msg}: {p:.0f}%")
    )
    
    print(f"综述: {result.review_path}")
    print(f"敏感性报告: {result.sensitivity_report_path}")
    
    # 查看权重分析结果
    if result.weight_result:
        ir = result.weight_result.isolation_rate
        print(f"孤证率: {ir.ir_percentage:.1f}%")
        print(f"关注级别: {ir.concern_level}")

asyncio.run(main())
```

### 常用命令速查

```bash
# 处理单个文档
python main.py process paper.pdf

# 批量处理
python main.py batch papers/*.pdf

# 处理整个目录
python main.py directory ./papers

# IVDH 专业化分析
python main.py batch papers/*.pdf --enable-ivdh-mri --enable-multi-omics

# 启动审核界面
python main.py ui --port 8080

# 查看缓存
python main.py cache --stats

# 清除缓存
python main.py cache --clear

# 查看帮助
python main.py --help
```

### 遇到问题？

1. **"python: command not found"** → 用 `python3` 代替 `python`
2. **"ModuleNotFoundError"** → 确保激活了虚拟环境，然后重新运行 `pip install -r requirements.txt`
3. **"API key not found"** → 检查 `.env` 文件是否存在并包含 API 密钥
4. **处理失败** → 尝试简化命令：`python main.py process paper.pdf --no-gap-analysis --no-forest-plot`

详细帮助请查看 [docs/newbie_guide.md](docs/newbie_guide.md)

## 系统架构

Medical Review Skill 采用四层处理架构，从 PDF 文档中自动提取结构化数据：

```
┌─────────────────────────────────────────────────────────────────┐
│                        Layer 4: 人类审核层                         │
│         审核界面 → 冲突解决 → 质量报告                              │
└─────────────────────────────────────────────────────────────────┘
                              ▲
┌─────────────────────────────────────────────────────────────────┐
│                      Layer 3: 引用硬化层                           │
│         指纹生成 → 引用验证 → 自动修复 (向量数据库)                  │
└─────────────────────────────────────────────────────────────────┘
                              ▲
┌─────────────────────────────────────────────────────────────────┐
│                    Layer 2: 一致性检查层                           │
│        语义一致性 → 数值一致性 → 引用一致性                         │
│        GAP Score → 证据硬度 → 残差验证                             │
└─────────────────────────────────────────────────────────────────┘
                              ▲
┌─────────────────────────────────────────────────────────────────┐
│                   Layer 1: 双Agent提取层                          │
│              Agent A + Agent B → 裁决者                           │
└─────────────────────────────────────────────────────────────────┘
                              ▲
┌─────────────────────────────────────────────────────────────────┐
│                      Layer 0: 智能解析层                           │
│         PDF路由 → SVG提取 → 自适应二值化                           │
└─────────────────────────────────────────────────────────────────┘
```

### 核心概念

#### 数据点 (DataPoint)

系统的核心输出，代表从文献中提取的一个具体信息：

```python
{
    "id": "uuid",
    "claim": "椎间盘突出发病率约为5%",
    "category": "epidemiology",
    "subcategory": "prevalence",
    "evidence_type": "cohort_study",
    "source": {
        "document_id": "doc_001",
        "document_title": "Study Title",
        "doi": "10.1000/xyz123",
        "pmid": "12345678",
        "page": 12,
        "paragraph": 3,
        "section": "Results",
        "text_snippet": "..."
    },
    "confidence": 0.92,
    "context": "原文上下文...",
    "extracted_at": "2026-03-19T09:00:00Z",
    "extracted_by": "agent_a",
    "extraction_method": "llm_extraction",
    "metadata": {
        "language": "zh",
        "verified": true
    }
}
```

#### 证据类型分级

系统使用以下证据等级（从高到低）：

1. **Systematic Review / Meta-analysis** (最高)
2. **Randomized Controlled Trial**
3. **Cohort Study**
4. **Case-Control Study**
5. **Cross-sectional Study**
6. **Case Series / Case Report**
7. **Expert Opinion** (最低)

## 输出文件说明

处理完成后，输出目录包含以下文件：

```
output_dir/
├── Nature_Review_Draft.md          # Nature Reviews 风格综述草案
│   ├── Key Points
│   ├── Evidence Hardening 表格
│   ├── Data Reliability 表格
│   ├── Clinical Implications
│   └── Methodology & Limitations
│
├── Evidence_Hardness_Log.csv       # 证据硬度评分日志
├── Forest_Plot_Standard.png        # 标准森林图 (需 R 服务)
├── Forest_Plot_Sensitive.png       # 敏感性分析森林图 (需 R 服务)
├── Clinical_Conflict_Map.json      # 临床冲突图 (孤证率分析)
├── Sensitivity_Analysis_Report.md  # 敏感性分析报告 (LOO 分析)
└── Audit_Trail_Log.json            # 完整审计日志
```

## 项目结构

```
medical_review_skill_v4.3/
├── main.py                      # 主入口程序
├── pyproject.toml              # Python 包配置
├── requirements.txt            # 依赖列表
├── docker-compose.yml          # Docker 编排配置
├── Dockerfile                  # 主服务镜像
├── Dockerfile.r-base           # R 服务镜像
│
├── configs/                    # 配置文件 (5个)
│   ├── config.yaml             # 主配置文件
│   ├── config.example.yaml     # 配置示例 (统一多厂商模板)
│   ├── services.yaml           # 服务配置
│   ├── vector_store_example.yaml # 向量存储配置示例
│   └── weaknesses.yaml         # 弱点检测配置
│
├── src/                        # 源代码 (126个Python文件)
│   ├── layer0_parser/          # Layer 0: PDF 解析 (8文件)
│   ├── layer1_dual_agent/      # Layer 1: 双 Agent 提取 (18文件)
│   ├── layer2_consistency/     # Layer 2: 一致性检查 (13文件)
│   ├── layer3_citation/        # Layer 3: 引用硬化 (12文件)
│   ├── layer4_ui/              # Layer 4: 人工审核界面 (13文件)
│   ├── pipeline/               # 处理流程编排
│   ├── shared/                 # 共享组件
│   └── __init__.py
│
├── tests/                      # 测试目录 (94个Python文件)
│   ├── layer0_parser/          # Layer 0 测试
│   ├── layer1_dual_agent/      # Layer 1 测试
│   ├── layer2_consistency/     # Layer 2 测试
│   ├── layer3_citation/        # Layer 3 测试
│   ├── layer4_ui/              # Layer 4 测试
│   ├── integration/            # 集成测试
│   ├── shared/                 # 共享组件测试
│   ├── unit/                   # 单元测试
│   ├── e2e/                    # 端到端测试
│   ├── benchmarks/             # 性能基准测试 (v4.3+)
│   └── TEST_DEVELOPMENT_GUIDE.md # 测试开发指南 (v4.3+)
│
├── docs/                       # 文档目录 (13个文件)
│   ├── README.md               # 文档索引
│   ├── newbie_guide.md         # 新手指南
│   ├── usage.md                # 使用指南
│   ├── configuration.md        # 配置指南
│   ├── architecture.md         # 架构设计
│   ├── api.md                  # API 参考
│   ├── deployment.md           # 部署指南
│   └── advanced/               # 高级主题 (6个文件)
│       ├── caching.md          # 缓存系统
│       ├── failure_cases.md    # 失败案例分析
│       ├── internals.md        # 内部机制 (DI+错误处理)
│       ├── r_integration.md    # R 环境集成
│       ├── technical_reference.md  # 技术参考
│       └── vector_store.md     # 向量存储
│
├── examples/                   # 示例文件 (12个)
│   ├── basic_usage.py          # 基础使用
│   ├── config_example.py       # 配置示例
│   ├── multi_provider_example.py   # 多厂商示例
│   ├── layer0_example.py       # Layer 0 示例
│   ├── layer4_ui_usage.py      # Layer 4 UI 示例
│   └── ...                     # 其他功能示例
│
├── scripts/                    # 工具脚本
├── services/                   # 外部服务
│   └── r_service/              # R 统计服务
├── prompts/                    # Prompt 模板
├── data/                       # 数据目录
└── outputs/                    # 输出目录
```

### 文件数量统计

| 类别 | 文件数 | 说明 |
|------|--------|------|
| 配置文件 | 4 | 多厂商配置支持 |
| 源代码 | 126 | 四层架构核心代码 |
| 测试代码 | 94 | 单元/集成/E2E/基准测试 |
| 文档 | 13+ | 用户指南、API文档、架构设计 |
| 示例 | 15 | 功能使用示例 |
| **总计** | **~252** | 核心项目文件 |

## 文档

| 文档 | 说明 | 适合读者 |
|------|------|---------|
| [使用指南](docs/usage.md) | 详细使用说明和示例 | 所有用户 |
| [配置指南](docs/configuration.md) | LLM、嵌入模型、向量数据库配置 | 所有用户 |
| [架构设计](docs/architecture.md) | 四层架构详细说明 | 开发者 |
| [API 参考](docs/api.md) | Python API 完整参考 | 开发者 |
| [部署指南](docs/deployment.md) | 生产环境部署 | 运维 |
| [R 集成](docs/advanced/r_integration.md) | 森林图与生存分析、Meta 分析 | 研究者 |
| [向量存储](docs/advanced/vector_store.md) | 向量数据库配置 | 开发者 |
| [高级主题](docs/README.md#-高级主题) | 缓存、DI框架、错误处理等 | 开发者 |
| [Prompt 设计](prompts/docs/) | Agent Prompt 设计文档 | 开发者 |
| [测试开发指南](tests/TEST_DEVELOPMENT_GUIDE.md) | 测试编写规范和最佳实践 | 开发者 |

## 技术栈

- **Python**: 3.10+
- **数据验证**: Pydantic v2
- **PDF处理**: PyMuPDF, OpenCV, scikit-image
- **LLM 客户端**: Anthropic, OpenAI, OpenRouter 等
- **向量数据库**: Chroma, Qdrant, Pinecone, Milvus, Simple (内存)
- **嵌入模型**: Simple Hash, Local (sentence-transformers), OpenAI, OpenRouter
- **R 集成**: rpy2, IPDfromKM (生存曲线重建)
- **工作流**: asyncio
- **测试**: pytest, pytest-cov, pytest-benchmark (性能测试)
- **代码质量**: ruff, mypy

## 支持的 LLM 提供商

| 提供商 | 环境变量 | 推荐模型 | 文档 |
|--------|----------|----------|------|
| Anthropic | `ANTHROPIC_API_KEY` | claude-3-5-sonnet-20241022 | [官网](https://console.anthropic.com/) |
| OpenAI | `OPENAI_API_KEY` | gpt-4o | [官网](https://platform.openai.com/) |
| OpenRouter | `OPENROUTER_API_KEY` | anthropic/claude-3.5-sonnet | [官网](https://openrouter.ai/) |
| 火山引擎 | `VOLCENGINE_API_KEY` | deepseek-r1-250120 | [文档](https://www.volcengine.com/docs/82379/1928261) |
| Kimi | `KIMI_API_KEY` | kimi-latest | [文档](https://platform.moonshot.cn/docs/intro) |
| GLM (Z.AI) | `GLM_API_KEY` | glm-5 | [文档](https://docs.z.ai/api-reference/introduction) |
| MiniMax | `MINIMAX_API_KEY` | MiniMax-M2.5 | [文档](https://platform.minimax.io/docs/coding-plan/intro) |

## 支持的嵌入模型提供商

| 提供商 | 环境变量 | 推荐模型 | 说明 |
|--------|----------|----------|------|
| Simple | 无需配置 | simple-hash | 基于哈希，无需外部依赖，用于测试 |
| Local | 无需配置 | all-MiniLM-L6-v2 | 本地 sentence-transformers 模型 |
| OpenAI | `OPENAI_API_KEY` | text-embedding-3-small | OpenAI 官方嵌入 API |
| OpenRouter | `OPENROUTER_API_KEY` | openai/text-embedding-3-small | 通过 OpenRouter 访问多厂商嵌入模型 |
| Volcengine | `VOLCENGINE_API_KEY` | 火山引擎嵌入模型 | 火山引擎嵌入服务 |

## GAP Score N-GSR 生物力学引擎

基于 Yilgor GAP Score 计算脊柱矢状位平衡风险：

```python
from src.layer2_consistency.gap_risk_engine import GAPRiskEngine, SpineMeasurements

engine = GAPRiskEngine()

measurements = SpineMeasurements(
    pi=55.0,      # 骨盆入射角
    pt=20.0,      # 骨盆倾斜角
    ss=35.0,      # 骶骨倾斜角
    ll=-50.0,     # 腰椎前凸角
    l1_l4=-25.0,  # L1-L4 前凸
    l4_s1=-25.0,  # L4-S1 前凸
    age=65,
)

profile = engine.calculate_risk(measurements)
print(f"Risk Score: {profile.final_score}")
print(f"PJK Probability: {profile.pjk_probability:.2%}")
```

## 开发

### 运行测试

```bash
# 运行所有测试
pytest tests/ -v

# 运行特定模块测试
pytest tests/layer0_parser/ -v

# 生成覆盖率报告
pytest tests/ --cov=src --cov-report=html
```

### 性能基准测试

```bash
# 运行性能基准测试
pytest tests/benchmarks/ --benchmark-only

# 保存基准结果
pytest tests/benchmarks/ --benchmark-only --benchmark-autosave

# 生成性能报告
python tests/benchmarks/generate_report.py
```

查看 [测试开发指南](tests/TEST_DEVELOPMENT_GUIDE.md) 了解如何编写测试。

### 代码检查

```bash
# 代码格式化
ruff format src/

# 代码检查
ruff check src/

# 类型检查
mypy src/
```

## 代码质量与架构改进 (v4.3+)

### 模型架构重构

**extraction_models 拆分**: 原 `extraction_models.py` (1774行) 已拆分为多个子模块：

```
src/layer1_dual_agent/models/
├── __init__.py              # 统一导出
├── clinical_models.py       # 临床相关模型 (PJK/PJF, 年龄校正等)
├── chart_models.py          # 图表相关模型 (数据点, 坐标轴等)
└── adjudication_models.py   # 裁决相关模型
```

所有现有导入保持向后兼容，无需修改代码。

### 异步事件循环优化

修复了多个缓存模块中的异步事件循环问题：
- `pdf_parse_cache.py`
- `extraction_cache.py`
- `verification_cache.py`

使用统一的 `_run_async()` 方法处理异步调用，确保线程安全。

### 配置可定制化

硬编码的生物力学默认值已提取到配置文件：
```yaml
biomechanics:
  ll_default: -50.0
  l1_l4_default: -25.0
  l4_s1_default: -25.0
  age_default: 60
```

### 代码重复消除

提取了 `agent_a.py` 和 `agent_b.py` 的公共逻辑到 `base_extractor.py`：
- 减少重复代码约 400 行
- 统一 LLM 客户端创建逻辑
- 标准化配置读取

## Docker 部署

```bash
# 构建镜像
docker-compose build

# 启动完整服务 (包含 R 服务和 Redis)
docker-compose up -d

# 仅启动应用
docker-compose up -d app

# 查看日志
docker-compose logs -f

# 开发模式
docker-compose --profile dev up -d app-dev
```

## R 服务配置 (可选)

如需生成森林图和进行 IPD 重建：

```bash
# 安装 R 依赖
Rscript scripts/install_r_dependencies.R

# 启动 R Plumber 服务
Rscript services/r_service/start.R

# 或使用 Docker
docker-compose up -d r-service
```

服务默认在 `http://localhost:8000` 运行。

## 配置

配置文件位于 `configs/config.yaml`，所有配置项都可以通过环境变量覆盖，前缀为 `MRS_`:

```bash
export MRS_LLM__API_KEY="your-key"
export MRS_LLM__PROVIDER="anthropic"
export MRS_LOGGING__LEVEL="DEBUG"
export MRS_PIPELINE__VECTOR_STORE_PROVIDER="chroma"
export MRS_PIPELINE__EMBEDDING__PROVIDER="openai"
```

## 故障排除

### R 服务连接失败

```
R service not available, skipping forest plot generation
```

**解决方案**:
```bash
# 启动 R 服务
Rscript services/r_service/start.R &

# 或禁用森林图生成
python main.py batch *.pdf --no-forest-plot
```

### PDF 解析失败

**解决方案**:
- 检查 PDF 文件是否损坏
- 尝试使用 `--no-layer3` 跳过引用硬化
- 检查 PyMuPDF 安装: `pip install PyMuPDF`

### 内存不足

```bash
# 减少并发数
python main.py batch *.pdf --max-concurrent 1

# 分批处理
python main.py batch doc1.pdf doc2.pdf --output ./batch1
python main.py batch doc3.pdf doc4.pdf --output ./batch2
```

## 许可证

[MIT License](LICENSE)

## 贡献

欢迎提交 Issue 和 Pull Request。

## 致谢

- Claude (Anthropic) - AI 模型支持
- GPT (OpenAI) - AI 模型支持
- DeepSeek, Doubao (火山引擎) - AI 模型支持
- Kimi (Moonshot AI) - AI 模型支持
- GLM (Z.AI) - AI 模型支持
- MiniMax - AI 模型支持
- PyMuPDF - PDF 处理
- Pydantic - 数据验证
- IPDfromKM (R package) - 生存曲线重建

## 相关文档

- [新手指南](docs/newbie_guide.md) - 从零开始的快速入门
- [使用指南](docs/usage.md) - 详细的命令行和 API 使用说明
- [架构设计](docs/architecture.md) - 系统架构和技术细节
- **[IVDH 模块文档](docs/ivdh_modules.md)** - IVDH 专业化功能详细介绍
- **[数据模型参考](docs/data_models.md)** - Pydantic 数据模型完整参考
- [部署指南](docs/deployment.md) - 生产环境部署说明
- [配置指南](docs/configuration.md) - 配置文件详解

## 最佳实践

### 文档准备

1. **PDF 质量**: 使用清晰的 PDF，避免低分辨率扫描件
2. **OCR 检查**: 确保 PDF 可搜索（有文本层）
3. **文件命名**: 使用有意义的文件名，如 `2024_lumbar_disc_review.pdf`

### 批量处理

```bash
# 分批处理，每批 5-10 篇
python main.py directory ./papers --output ./review --max-concurrent 4

# 保存中间结果，便于故障恢复
python main.py batch *.pdf --output ./review --save-intermediates
```

### 质量控制

1. **不要跳过 Layer 2 和 Layer 3**: 保持三层一致性验证开启
2. **人工审核**: 对低置信度（<0.7）结果进行人工审核
3. **定期校准**: 检查结果质量，调整配置参数

### 数据安全

1. **API 密钥**: 使用环境变量，不要硬编码到代码中
2. **敏感数据**: 处理敏感医学数据时注意合规要求
3. **日志清理**: 定期清理包含敏感信息的日志

## 引用

如果使用本工具，请引用：

```bibtex
@software{medical_review_skill_v43,
  title = {Medical Review Skill v4.3: One-Click Nature Reviews Orchestrator},
  year = {2026},
  url = {https://github.com/medical-review/skill-v43}
}
```
