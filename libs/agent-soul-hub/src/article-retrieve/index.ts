import { AgentBlueprint } from 'agent-lib/core';
import {
  BibliographySearchComponent,
  LineageControlComponent,
  LifecycleComponent,
} from 'component-hub';

const SOP_CONTENT = `# 综合文献检索策略
### 基本检索步骤
1. 制定检索策略，使用工具搜索pubmed，Workspace会发生刷新而现实检索结果
2. 检查检索结果数量，若数量过多、过少、与检索目标相关性差，则需要调整检索策略，重新进行第一步
3. 检索结果合适后，使用翻页工具主页浏览，使用查看细节工具逐个检查文献，并使用收藏工具收集文献。在你完成任务时，你所收藏的文献会作为你的工作结果上传。

注意Workspace上下文在每轮请求都会刷新，不会保存之前的记录，请你注意返回结果时在文本中详细记录当前行为

### 第一步：确立核心检索词 (Core Keywords)
在组合各类检索之前，我们需要根据任务中给定的**目标疾病或主题**构建核心词集。

构建原则：
- 优先使用 MeSH 主题词（如 \`"Disease Name"[MeSH]\`）
- 补充常用同义词和不同表述（如 \`"disease name"\`、\`"disease alias"\`）
- 涵盖疾病的不同亚型或分期
- *(下文为了公式简洁，将上述集合简称为 [DISEASE_CORE])*

---

### 第二步：分模块分层检索策略 (Section-by-Section Search)

#### 1. 流行病学与危险因素 (Epidemiology & Risk Factors)

**检索目标：** 发病率、患病率、危险因素（遗传、环境、生活方式）、共病。

- **检索策略：**\`[DISEASE_CORE] AND ("Epidemiology"[MeSH] OR incidence OR prevalence OR "risk factors" OR "global burden" OR genetics OR "environmental factors" OR "body mass index" OR obesity)\`
- **重点筛选：** 寻找 Global Burden of Disease (GBD) 最新数据，以及大样本队列研究。
- 操作步骤：
    1. 执行检索：检索使用工具应用检索策略搜索pubmed，Bibliography组件会随之刷新现实检索结果。你需要综合检索结果数量、文献相关度决定是否进行检索策略调整。推荐检索结果在10~30条目。
    2. 文献录入：使用工具逐一查看文献详情，判断文献符合录入标准后，通过收藏工具录入文献。你所收藏的文献会作为你的工作结果，在任务完成时导出。

#### 2. 病理机制 (Mechanisms/Pathophysiology)

**检索目标：** 组织层面的病理改变、疾病表型、分子机制。

- **检索策略：**\`[DISEASE_CORE] AND ("Pathophysiology"[MeSH] OR mechanism* OR "molecular mechanism" OR "signal transduction" OR "inflammatory cascade" OR cytokines OR "immune response" OR apoptosis OR "disease progression")\`
- **重点筛选：** 疾病的分子生物学机制、信号通路、炎症/免疫机制。
- 操作步骤：
    1. 执行检索：检索使用工具应用检索策略搜索pubmed，Bibliography组件会随之刷新现实检索结果。你需要综合检索结果数量、文献相关度决定是否进行检索策略调整。推荐检索结果在10~30条目。
    2. 文献录入：使用工具逐一查看文献详情，判断文献符合录入标准后，通过收藏工具录入文献。你所收藏的文献会作为你的工作结果，在任务完成时导出。


#### 3. 诊断、筛查与预防 (Diagnosis, Screening and Prevention)

**检索目标：** 临床症状、诊断标准、鉴别诊断、早期筛查与预防。

- **检索策略：**\`[DISEASE_CORE] AND ("Diagnosis"[MeSH] OR "physical examination" OR "clinical presentation" OR "differential diagnosis" OR screening OR prevention OR "prognostic factors" OR "biomarkers")\`
- **重点筛选：** 诊断方法的应用与局限性、不同分型/分期的标准。
- 操作步骤：
    1. 执行检索：检索使用工具应用检索策略搜索pubmed，Bibliography组件会随之刷新现实检索结果。你需要综合检索结果数量、文献相关度决定是否进行检索策略调整。推荐检索结果在10~30条目。
    2. 文献录入：使用工具逐一查看文献详情，判断文献符合录入标准后，通过收藏工具录入文献。你所收藏的文献会作为你的工作结果，在任务完成时导出。

#### 4. 疾病管理与治疗 (Management)

**检索目标：** 阶梯治疗方案：基础生活干预、药物治疗、手术治疗以及指南依从性。

- **检索策略：**\`[DISEASE_CORE] AND ("Therapeutics"[MeSH] OR "Disease Management"[MeSH] OR "conservative treatment" OR pharmacotherapy OR surgery OR "clinical guidelines" OR "treatment outcome")\`
- **重点筛选：** 各专业协会的最新临床指南、不同治疗方案的疗效比较（RCT荟萃分析）。
- 操作步骤：
    1. 执行检索：检索使用工具应用检索策略搜索pubmed，Bibliography组件会随之刷新现实检索结果。你需要综合检索结果数量、文献相关度决定是否进行检索策略调整。推荐检索结果在10~30条目。
    2. 文献录入：使用工具逐一查看文献详情，判断文献符合录入标准后，通过收藏工具录入文献。你所收藏的文献会作为你的工作结果，在任务完成时导出。

#### 5. 生活质量与社会负担 (Quality of Life & Burden)

**检索目标：** 全球残疾负担（YLDs）、个人健康相关生活质量（HRQoL）、直接与间接经济成本。

- **检索策略：**\`[DISEASE_CORE] AND ("Quality of Life"[MeSH] OR QoL OR "Cost of Illness"[MeSH] OR DALY OR YLD OR "health economics" OR "absenteeism" OR disability OR "disease trajectory")\`
- **重点筛选：** 疾病导致的缺勤成本、心理共病对生活质量的影响。
- 操作步骤：
    1. 执行检索：检索使用工具应用检索策略搜索pubmed，Bibliography组件会随之刷新现实检索结果。你需要综合检索结果数量、文献相关度决定是否进行检索策略调整。推荐检索结果在10~30条目。
    2. 文献录入：使用工具逐一查看文献详情，判断文献符合录入标准后，通过收藏工具录入文献。你所收藏的文献会作为你的工作结果，在任务完成时导出。

#### 6. 展望与新兴疗法 (Outlook & Emerging Treatments)

**检索目标：** 新兴疗法（干细胞、基因治疗、靶向治疗、组织工程、精准医学）。

- **检索策略：**\`[DISEASE_CORE] AND ("Tissue Engineering"[MeSH] OR "Stem Cells"[MeSH] OR "Biomarkers"[MeSH] OR biologics OR "regenerative medicine" OR "gene therapy" OR "targeted therapy" OR "precision medicine" OR "emerging therapies" OR "future directions")\`
- **重点筛选：** 新型治疗技术、再生医学、精准医学的最新进展。
- 操作步骤：
    1. 执行检索：检索使用工具应用检索策略搜索pubmed，Bibliography组件会随之刷新现实检索结果。你需要综合检索结果数量、文献相关度决定是否进行检索策略调整。推荐检索结果在10~30条目。
    2. 文献录入：使用工具逐一查看文献详情，判断文献符合录入标准后，通过收藏工具录入文献。你所收藏的文献会作为你的工作结果，在任务完成时导出。

---

### 检索建议(Pro-Tips)

1. **设立时间限制（Time Filters）：** 将检索时间限制在 **近5年** 内的高质量文献，重点阅读顶级期刊上的大综述和RCT。
2. **筛选文献类型（Article Types）：** 优先筛选 **Systematic Reviews** 和 **Meta-Analyses**，这些文献能为你提供坚实的数据支撑。
3. **注意术语辨析：** 在引言部分，明确区分相关但不同的概念（如不同疾病亚型、急慢性分类等）。`;

export function createBibRetrieveAgentSoul(): AgentBlueprint {
  return {
    agent: {
      sop: SOP_CONTENT,
      name: 'Paper Analysis Agent',
      type: 'paper-analysis',
      description: 'Specialized agent for scientific paper analysis',
    },
    components: [
      {
        componentClass: BibliographySearchComponent,
      },
      { componentClass: LineageControlComponent, priority: 0 },
      { componentClass: LifecycleComponent, priority: 100 },
    ],
  };
}
