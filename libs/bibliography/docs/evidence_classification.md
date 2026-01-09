# 循证医学文献管理系统 - 证据类型定义体系

## 一、系统设计原则

### 1.1 设计目标

| 目标       | 说明                        |
| ---------- | --------------------------- |
| **全面性** | 覆盖循证医学所有证据类型    |
| **层次性** | 体现证据金字塔的层级关系    |
| **实用性** | 便于临床检索和决策支持      |
| **兼容性** | 支持GRADE等主流证据分级系统 |
| **扩展性** | 便于后续添加新类型          |

### 1.2 数据结构设计框架

```
证据类型定义 (Evidence Type Definition)
├── 基础分类
│   ├── 顶层分类 (Primary Category)
│   ├── 子分类 (Subcategory)
│   └── 研究设计 (Study Design)
├── 证据级别
│   ├── GRADE等级 (High/Medium/Low/Very Low)
│   ├── 传统等级 (Traditional Level)
│   └── OCEBM等级 (OCEBM Level 1a-5)
├── 临床适用性
│   ├── 适用问题类型 (Clinical Question Type)
│   ├── 适用阶段 (Research Phase)
│   └── 转化价值 (Translational Value)
├── 质量评估
│   ├── 偏倚风险评估工具 (Risk of Bias Tool)
│   ├── 报告规范 (Reporting Guideline)
│   └── 质量维度 (Quality Dimensions)
└── 元数据
    ├── 关键词 (Keywords)
    ├── MeSH词 (MeSH Terms)
    └── 检索过滤 (Search Filters)
```

---

## 二、完整证据类型定义表

## 2.1 一级分类体系

| Type Code | 一级分类名称       | 英文名称                          | 描述                                   | 包含子类型数 |
| --------- | ------------------ | --------------------------------- | -------------------------------------- | ------------ |
| **SA**    | 系统评价与Meta分析 | Systematic Review & Meta-Analysis | 系统性收集、评价多个研究的最高级别证据 | 8            |
| **R**     | 实验研究           | Experimental Studies              | 主动干预的研究设计，包括RCT            | 6            |
| **O**     | 观察性研究         | Observational Studies             | 不干预的自然观察研究                   | 8            |
| **D**     | 诊断性研究         | Diagnostic Studies                | 评估诊断方法的准确性                   | 5            |
| **P**     | 预后研究           | Prognostic Studies                | 研究疾病发展和预测因素                 | 5            |
| **H**     | 危害/病因研究      | Harm/Etiology Studies             | 研究疾病原因和风险因素                 | 5            |
| **HE**    | 卫生经济学研究     | Health Economic Studies           | 成本效益、成本效用等经济学评价         | 5            |
| **C**     | 临床实践指南       | Clinical Practice Guidelines      | 系统性的临床建议                       | 3            |
| **CR**    | 方法学研究         | Methodological Research           | 研究方法学改进和发展                   | 3            |
| **B**     | 基础科学           | Basic Science                     | 动物实验、体外实验等基础研究           | 4            |
| **OJ**    | 专家意见/共识      | Expert Opinion/Consensus          | 专家观点、共识声明                     | 3            |
| **RE**    | 综述/评论          | Review/Commentary                 | 叙述性综述、编辑部评论                 | 2            |

---

## 2.2 详细证据类型定义（逐级展开）

### **SA类：系统评价与Meta分析**

| Type Code | 类型名称       | 英文名称                              | GRADE初始等级 | OCEBM等级 | 适用问题     | 偏倚评估工具 | 报告规范    |
| --------- | -------------- | ------------------------------------- | ------------- | --------- | ------------ | ------------ | ----------- |
| **SA01**  | 干预性Meta分析 | Meta-analysis of Intervention Studies | **高**        | 1a        | 治疗         | AMSTAR 2     | PRISMA 2020 |
| **SA02**  | 诊断性Meta分析 | Meta-analysis of Diagnostic Studies   | **高→中**     | 1a        | 诊断         | QUADAS       | PRISMA-DTA  |
| **SA03**  | 预后性Meta分析 | Meta-analysis of Prognostic Studies   | **低→中**     | 2a        | 预后         | QUIPS        | PRISMA      |
| **SA04**  | 危害性Meta分析 | Meta-analysis of Harm Studies         | **中**        | 2a-1a     | 危害         | NOS/ROBINS-I | PRISMA      |
| **SA05**  | 网络Meta分析   | Network Meta-Analysis                 | **高**        | 1a        | 治疗         | CINeMA       | PRISMA-NMA  |
| **SA06**  | 伞状综述       | Umbrella Review                       | **高**        | 1a        | 综合         | AMSTAR 2     | PRISMA      |
| **SA07**  | 范围综述       | Scoping Review                        | 不适用        | —         | 概览         | 不适用       | PRISMA-ScR  |
| **SA08**  | 快速综述       | Rapid Review                          | **低**        | —         | 时间敏感决策 | AMSTAR 2     | PRISMA-R    |

#### 子类型特征说明

```json
{
  "SA01": {
    "description": "治疗、预防或干预措施的系统评价和Meta分析",
    "inclusion": "至少包含2个以上RCT",
    "statistical_method": "[RevMan, R-metafor, Stata-meta]",
    "key_indicators": ["OR", "RR", "RD", "MD", "SMD", "I²", "Q"]
  },
  "SA02": {
    "description": "诊断试验准确性的系统评价",
    "inclusion": "包含诊断准确性研究",
    "statistical_method": "[HSROC, Bivariate Model]",
    "key_indicators": ["Sensitivity", "Specificity", "LR+", "LR-", "DOR", "AUC"]
  },
  "SA05": {
    "description": "同时比较多种干预措施的统计分析",
    "requirement": "需要闭合三角或者具有共同对照",
    "statistical_method": "[Bayesian NMA, Frequentist NMA]"
  }
}
```

---

### **R类：实验研究（Experimental Studies）**

| Type Code | 类型名称         | 英文名称              | GRADE初始等级 | OCEBM等级 | 适用问题 | 偏倚评估工具     | 报告规范          |
| --------- | ---------------- | --------------------- | ------------- | --------- | -------- | ---------------- | ----------------- |
| **R01**   | 平行随机对照试验 | Parallel RCT          | **高**        | 1b        | 治疗     | Cochrane RoB 2.0 | CONSORT           |
| **R02**   | 交叉随机对照试验 | Crossover RCT         | **高**        | 1b        | 治疗     | Cochrane RoB 2.0 | CONSORT           |
| **R03**   | 整群随机对照试验 | Cluster RCT           | **高**        | 1b        | 治疗     | Cochrane RoB 2.0 | CONSORT-extension |
| **R04**   | 非劣效性试验     | Non-inferiority Trial | **高**        | 1b        | 治疗     | Cochrane RoB 2.0 | CONSORT-extension |
| **R05**   | 步骤楔形RCT      | Stepped Wedge RCT     | **高**        | 1b        | 治疗     | Cochrane RoB 2.0 | CONSORT-extension |
| **R06**   | 随机化前设计     | Pre-randomized Design | **中高**      | 2b        | 治疗     | Cochrane RoB 2.0 | CONSORT           |

#### R类子类型特征

```json
{
  "R01": {
    "key_features": {
      "randomization": "Individual-level randomization",
      "parallel_groups": "2+ separate intervention arms",
      "follow_up": "Concurrent follow-up"
    },
    "quality_criteria": [
      "Adequate allocation concealment",
      "Blinding (double preferred)",
      "Intention-to-treat analysis",
      "Follow-up ≥80%"
    ]
  },
  "R02": {
    "key_features": {
      "randomization": "Randomized to different treatment sequences",
      "crossover": "Each participant receives all interventions",
      "washout_period": "Required to avoid carryover effect"
    },
    "best_for": "Chronic stable conditions, treatments with temporary effects"
  },
  "R03": {
    "key_features": {
      "randomization": "Cluster/groups randomized (e.g., hospitals, communities)",
      "complexity": "Higher ICC, need cluster-level analysis"
    },
    "best_for": "Interventions hard to apply individually, community-based interventions"
  }
}
```

---

### **O类：观察性研究（Observational Studies）**

| Type Code | 类型名称         | 英文名称                   | GRADE初始等级 | OCEBM等级 | 适用问题  | 偏倚评估工具   | 报告规范 |
| --------- | ---------------- | -------------------------- | ------------- | --------- | --------- | -------------- | -------- |
| **O01**   | 前瞻性队列研究   | Prospective Cohort Study   | **低**        | 2a        | 预后/危害 | ROBINS-I / NOS | STROBE   |
| **O02**   | 回顾性队列研究   | Retrospective Cohort Study | **低**        | 2b        | 预后/危害 | ROBINS-I / NOS | STROBE   |
| **O03**   | 病例对照研究     | Case-Control Study         | **低**        | 3b        | 危害/病因 | NOS / ROBINS-I | STROBE   |
| **O04**   | 嵌套病例对照研究 | Nested Case-Control Study  | **低**        | 3b        | 危害      | NOS            | STROBE   |
| **O05**   | 横断面研究       | Cross-sectional Study      | **低**        | 4         | 流行病学  | AXIS工具       | STROBE   |
| **O06**   | 生态学研究       | Ecological Study           | **极低**      | 2c        | 人群健康  | —              | STROBE   |
| **O07**   | 纵向研究         | Longitudinal Study         | **低**        | 2a        | 预后      | ROBINS-I       | STROBE   |
| **O08**   | 历史队列研究     | Historical Cohort Study    | **低**        | 2b        | 危害      | NOS / ROBINS-I | STROBE   |

#### 观察性研究质量维度

```json
{
  "O01": {
    "strengths": [
      "Can establish temporal sequence",
      "Suitable for rare outcomes",
      "Allows assessment of multiple exposures"
    ],
    "limitations": [
      "Susceptible to confounding",
      "Loss to follow-up bias",
      "Cannot prove causation"
    ],
    "quality_factors": {
      "selection": "Representative source population, clear inclusion/exclusion",
      "exposure": "Valid and reliable exposure measurement",
      "outcome": "Objective outcome assessment, blinding if possible",
      "confounding": "Control for major confounders in design/analysis"
    }
  }
}
```

---

### **D类：诊断性研究**

| Type Code | 类型名称           | 英文名称                       | GRADE初始等级 | OCEBM等级 | 适用问题 | 偏倚评估工具 | 报告规范   |
| --------- | ------------------ | ------------------------------ | ------------- | --------- | -------- | ------------ | ---------- |
| **D01**   | 队列诊断准确性研究 | Cohort Diagnostic Study        | **低→中**     | 1b-2b     | 诊断     | QUADAS-2     | STARD 2015 |
| **D02**   | 病例对照诊断研究   | Case-control Diagnostic Study  | **低**        | 3b        | 诊断     | QUADAS-2     | STARD 2015 |
| **D03**   | 比较诊断准确性研究 | Comparative Diagnostic Study   | **低→中**     | 2a        | 比较     | QUADAS-2     | STARD 2015 |
| **D04**   | 多模态诊断研究     | Multimodality Diagnostic Study | **低→中**     | 2a        | 整合诊断 | QUADAS-2     | STARD 2015 |
| **D05**   | 序贯诊断研究       | Sequential Diagnostic Study    | **低→中**     | 2a        | 治疗路径 | QUADAS-2     | STARD 2015 |

#### 诊断性研究评估指标

```json
{
  "D01": {
    "study_design": {
      "population": "Consecutive or random sample of suspected patients",
      "index_test": "New diagnostic method under evaluation",
      "reference_standard": "Established gold standard",
      "blinding": "Blinded interpretation of both tests"
    },
    "key_metrics": {
      "primary": ["Sensitivity", "Specificity", "LR+", "LR-", "DOR", "AUC"],
      "secondary": ["PPV", "NPV", "Accuracy", "Precision", "F1-score"]
    },
    "statistical_analysis": ["ROC curves", "HSROC model", "Bivariate model"]
  }
}
```

---

### **P类：预后研究**

| Type Code | 类型名称       | 英文名称                      | GRADE初始等级 | OCEBM等级 | 适用问题   | 偏倚评估工具 | 报告规范 |
| --------- | -------------- | ----------------------------- | ------------- | --------- | ---------- | ------------ | -------- |
| **P01**   | 预后队列研究   | Prognostic Cohort Study       | **低→中**     | 2a        | 预后       | QUIPS        | REMARK   |
| **P02**   | 预测模型研究   | Prediction Model Study        | **低→中**     | 2a        | 预测       | PROBAST      | TRIPOD   |
| **P03**   | 预后性研究注册 | Prognostic Registry           | **中**        | 2a        | 预后       | QUIPS        | REMARK   |
| **P04**   | 纵向预后研究   | Longitudinal Prognostic Study | **低→中**     | 2a        | 长期预后   | QUIPS        | REMARK   |
| **P05**   | 标志物预后研究 | Biomarker Prognostic Study    | **低→中**     | 2a        | 预测标志物 | QUIPS        | REMARK   |

#### 预后研究特殊要求

```json
{
  "P01": {
    "considerations": {
      "population": "Clearly defined at a uniform point in disease course",
      "follow_up": "Adequate duration to capture outcomes",
      "outcomes": "Objectively defined, blinded assessment",
      "competing_risks": "Account for competing risks (e.g., death from other causes)"
    },
    "time_to_event_analysis": "Kaplan-Meier, Cox proportional hazards",
    "prediction_metrics": [
      "C-statistic/AUC",
      "Calibration plot",
      "Decision curve analysis",
      "Net reclassification improvement (NRI)"
    ]
  }
}
```

---

### **H类：危害/病因研究**

| Type Code | 类型名称               | 英文名称                   | GRADE初始等级 | OCEBM等级 | 适用问题 | 偏倚评估工具   | 报告规范     |
| --------- | ---------------------- | -------------------------- | ------------- | --------- | -------- | -------------- | ------------ |
| **H01**   | RCT危害研究            | RCT for Harm Assessment    | **高→中**     | 1b        | 危害     | Cochrane RoB   | CONSORT      |
| **H02**   | 队列危害研究           | Cohort Study of Harm       | **低→中**     | 2a        | 危害     | ROBINS-I       | STROBE       |
| **H03**   | 病例对照危害研究       | Case-Control Study of Harm | **低**        | 3b        | 危害     | NOS / ROBINS-I | STROBE       |
| **H04**   | 自身对照研究           | Self-controlled Case Study | **中低**      | 3b-4      | 药物警戒 | NOS            | —            |
| **H05**   | 药品 epidemiology 研究 | Pharmacovigilance Study    | **低**        | 2c-3b     | 药物安全 | GRADE-CERQual  | STROBE-Pharm |

---

### **HE类：卫生经济学研究**

| Type Code | 类型名称     | 英文名称                          | GRADE初始等级 | OCEBM等级 | 适用问题   | 偏倚评估工具     | 报告规范             |
| --------- | ------------ | --------------------------------- | ------------- | --------- | ---------- | ---------------- | -------------------- |
| **HE01**  | 成本效果分析 | Cost-Effectiveness Analysis (CEA) | **低→中**     | 2a-3b     | 效率       | CHEERS           | CHEERS 2022          |
| **HE02**  | 成本效用分析 | Cost-Utility Analysis (CUA)       | **低→中**     | 2a-3b     | QALY/DALY  | CHEERS           | CHEERS               |
| **HE03**  | 成本效益分析 | Cost-Benefit Analysis (CBA)       | **低→中**     | 2a-3b     | 纯经济价值 | CHEERS           | CHEERS               |
| **HE04**  | 预算影响分析 | Budget Impact Analysis (BIA)      | **低→中**     | 2a-3b     | 预算规划   | ISPOR BIA Budget | ISPOR BIA Guidelines |
| **HE05**  | 疾病经济负担 | Cost of Illness Study             | **低→中**     | 3b-4      | 疾病负担   | —                | CHEERS               |

#### 经济学评估方法

```json
{
  "HE01": {
    "key_components": {
      "effectiveness": "Clinical outcomes from reference sources",
      "costs": "Direct costs, indirect costs, intangible costs",
      "perspective": "Healthcare system, societal, payer perspective",
      "time_horizon": "Discounting for long studies (usually 3-5%)"
    },
    "metrics": [
      "Incremental Cost-Effectiveness Ratio (ICER)",
      "Cost per QALY/DALY",
      "Willingness-to-pay threshold"
    ]
  }
}
```

---

### **C类：临床实践指南**

| Type Code | 类型名称        | 英文名称            | GRADE初始等级 | OCEBM等级 | 适用问题 | 偏倚评估工具 | 报告规范 |
| --------- | --------------- | ------------------- | ------------- | --------- | -------- | ------------ | -------- |
| **C01**   | 基于GRADE的指南 | GRADE-based CPG     | **中→高**     | —         | 推荐     | AGREE II     | RIGHT    |
| **C02**   | 基于共识的指南  | Consensus-based CPG | **中**        | —         | 推荐     | AGREE II     | RIGHT    |
| **C03**   | 机构性指南      | Institutional CPG   | **低→中**     | —         | 推荐     | AGREE II     | RIGHT    |

#### 指南质量评估维度（AGREE II）

```json
{
  "C01": {
    "AGREE_domains": {
      "scope_and_purpose": "Overall objectives, target population, expected outcomes",
      "stakeholder_involvement": "Patient/public/clinical experts inclusion",
      "rigour_of_development": "Systematic methods, evidence review, external review",
      "clarity_of_presentation": "Clear recommendations, different management options",
      "applicability": "Organizational barriers, resource implications, audit criteria",
      "editorial_independence": "Funding and conflict of interest statement"
    }
  }
}
```

---

### **B类：基础科学**

| Type Code | 类型名称         | 英文名称               | GRADE初始等级 | OCEBM等级 | 适用问题 | 偏倚评估工具 | 报告规范   |
| --------- | ---------------- | ---------------------- | ------------- | --------- | -------- | ------------ | ---------- |
| **B01**   | 动物实验         | Animal Experiment      | **极低**      | 5         | 机制     | SYRCLE RoB   | ARRIVE 2.0 |
| **B02**   | 体外实验         | In Vitro Experiment    | **极低**      | 5         | 机制     | —            | —          |
| **B03**   | 机制研究         | Mechanistic Study      | **极低**      | 5         | 机制     | —            | —          |
| **B04**   | 基础技术方法研究 | Basic Technical Method | **极低**      | 5         | 方法学   | —            | —          |

#### 动物实验偏倚评估（补充）

基于之前的详细内容，动物实验Meta分析作为特定子类别：

```json
{
  "B01_AnimalMeta": {
    "special_tool": "SYRCLE Risk of Bias tool tailored for animal studies",
    "ARRIVE_compliance": "ARRIVE 2.0 guidelines adherence (10 essential items)",
    "risk_of_bias_domains": [
      "Selection bias (randomization, baseline similarity)",
      "Performance bias (blinding during housing, random implementation)",
      "Detection bias (blinded outcome assessment)",
      "Attrition bias (incomplete outcome data)",
      "Reporting bias (selective reporting)",
      "Other bias (funding, animal welfare)"
    ],
    "GRADE_consideration": "Initial grade VERY LOW; may upgrade with large effect size, dose-response, plausible confounding"
  }
}
```

---

### **OJ类：专家意见/共识**

| Type Code | 类型名称      | 英文名称                   | GRADE初始等级 | OCEBM等级 | 适用问题 | 偏倚评估工具 | 报告规范 |
| --------- | ------------- | -------------------------- | ------------- | --------- | -------- | ------------ | -------- |
| **OJ01**  | 专家共识声明  | Expert Consensus Statement | **极低**      | 5         | 推荐     | —            | —        |
| **OJ02**  | 德尔菲研究    | Delphi Study               | **极低**      | 5         | 共识     | —            | —        |
| **OJ03**  | 专家观点/评论 | Expert Opinion/Commentary  | **极低**      | 5         | 观点     | —            | —        |

---

### **RE类：综述/评论**

| Type Code | 类型名称   | 英文名称             | GRADE初始等级 | OCEBM等级 | 适用问题 | 偏倚评估工具 | 报告规范 |
| --------- | ---------- | -------------------- | ------------- | --------- | -------- | ------------ | -------- |
| **RE01**  | 叙述性综述 | Narrative Review     | 不适用        | —         | 概览     | —            | —        |
| **RE02**  | 编辑部评论 | Editorial Commentary | 不适用        | —         | 观点     | —            | —        |

---

## 三、证据类型关联系统设计

### 3.1 Type关联字段设计

```json
{
  "evidence_type": {
    "primary_category": {
      "code": "SA",
      "name": "系统评价与Meta分析",
      "level": 1,
      "evidence_hierarchy_level": 1
    },
    "subcategory": {
      "code": "SA01",
      "name": "干预性Meta分析",
      "keywords": [
        "meta-analysis",
        "intervention",
        "treatment",
        "systematic review"
      ],
      "mesh_terms": ["Meta-Analysis", "Randomized Controlled Trial"],
      "parent_category": "SA"
    },
    "grading_system": {
      "GRADE": {
        "initial_grade": "High",
        "potential_downgrade_factors": [
          "limitations",
          "inconsistency",
          "indirectness",
          "imprecision",
          "publication_bias"
        ],
        "potential_upgrade_factors": [
          "large_effect",
          "dose_response",
          "plausible_confounding"
        ]
      },
      "OCEBM_level": "1a",
      "NHMRC_level": "I",
      "USPSTF_strength": "A/B/C/D/I"
    },
    "clinical_applicability": {
      "question_types": ["Treatment", "Prevention", "Rehabilitation"],
      "research_phase": ["Synthesis", "Conclusion"],
      "translational_value": "Clinical application"
    },
    "quality_assessment": {
      "risk_of_bias_tool": "AMSTAR 2",
      "reporting_guideline": "PRISMA 2020",
      "certainty_domains": [
        "Methodology",
        "Study selection",
        "Data extraction",
        "Statistical analysis",
        "Bias assessment"
      ]
    },
    "search_filters": {
      "PubMed_filter": "\"meta analysis\"[ptyp]",
      "Cochrane_filter": "\"meta-analysis\"",
      "Embase_filter": "\"meta analysis\".ab.",
      "keywords": ["meta-analysis", "systematic review", "pooled analysis"]
    },
    "metadata": {
      "created_date": "2025-01-09",
      "updated_date": "2025-01-09",
      "version": "2.1",
      "source": "EBM_LMS_Definition"
    }
  }
}
```

### 3.2 证据类型映射关系表

| Type | 对应MeSH词                                    | 对应PubMed过滤器                      | 临床问题类型              | GRADE路径          |
| ---- | --------------------------------------------- | ------------------------------------- | ------------------------- | ------------------ |
| SA01 | Meta-Analysis, Randomized Controlled Trial    | `"meta analysis"[ptyp]`               | Treatment                 | High→降级→最终     |
| SA02 | Diagnosis, Sensitivity and Specificity        | `AND "diagnostic"`                    | Diagnosis                 | High→中(降1-2)     |
| R01  | Randomized Controlled Trial                   | `"randomized controlled trial"[ptyp]` | Treatment                 | High→降级→最终     |
| O01  | Prospective Studies                           | `"prospective"[mh]`                   | Prognosis, Harm, Etiology | Low→升级→最终      |
| D01  | Diagnostic Tests, Sensitivity and Specificity | `"diagnosis"`                         | Diagnosis                 | Low→中(可能升)     |
| P01  | Prognosis                                     | `"prognos*"[tiab]`                    | Prognosis                 | Low→中(可能升)     |
| H01  | Drug-Related Side Effects                     | `"adverse effects"`                   | Harm                      | High→中(若来自RCT) |

---

## 四、系统功能建议

### 4.1 检索功能

```
检索维度设计：

1. 按证据级别检索
   ├─ GRADE等级: [High, Medium, Low, Very Low]
   ├─ OCEBM等级: [1a, 1b, 2a, 2b, 3a, 3b, 4, 5]
   └─ 金字塔层级: [Level 1-6]

2. 按研究类型检索
   ├─ 顶层类别: [SA, R, O, D, P, H, HE, C, B, OJ, RE]
   ├─ 子类别: [SA01-SA08, R01-R06, ...]
   └─ 研究设计: [Parallel RCT, Crossover, Cohort...]

3. 按临床问题检索
   ├─ Treatment/Prediction (治疗/预防)
   ├─ Diagnosis (诊断)
   ├─ Prognosis (预后)
   ├─ Etiology/Harm (病因/危害)
   └─ Economics (经济学)

4. 按质量工具检索
   ├─ 报告规范: [PRISMA, CONSORT, STARD, ARRIVE...]
   └─ 偏倚工具: [Cochrane RoB, QUADAS-2, SYRCLE...]

5. 组合检索
   └─ 例如: "Treatment问题 AND GRADE=High AND Type=RCT"
```

### 4.2 文献录入与自动分类

```
自动分类workflow：

1. 从数据库导入
   ↑
2. 提取标题/摘要/MeSH词
   ↑
3. AI/规则引擎匹配证据类型
   ├─ 关键词匹配 (如: "meta-analysis", "randomized")
   ├─ MeSH词匹配
   └─ 研究设计识别
   ↑
4. 建议Type Code
   ├─ SA01 (干预性Meta分析)
   ├─ R01 (平行RCT)
   └─ O01 (前瞻性队列)
   ↑
5. 手动确认/调整
   ├─ 查看匹配依据
   ├─ 修改Type Code
   └─ 添加GRADE调整因素
   ↑
6. 填充完整元数据
   ├─ GRADE初始等级
   ├─ 偏倚风险评估工具
   ├─ 报告规范符合性
   └─ 检索过滤条件
   ↑
7. 系统保存
```

### 4.3 证据质量评估模块

```
质量评估界面设计：

┌─────────────────────────────────────────────────┐
│          证据质量评估表 (Evidence Quality)      │
├─────────────────────────────────────────────────┤
│ Type: SA01 (干预性Meta分析)                     │
│ Title: XXXX                                     │
├─────────────────────────────────────────────────┤
│ 【GRADE初始等级】                                │
│ ○ High  ● Medium  ○ Low  ○ Very Low            │
│                                                 │
│ 【降级因素】（可多选）                           │
│ ☑ 研究局限性 (1级)                             │
│ ☑ 不一致性 (1级)                               │
│ □ 间接性                                       │
│ □ 不精确性                                     │
│ □ 发表偏倚                                     │
│                                                 │
│ 【升级因素】（可多选）                           │
│ □ 效应量巨大 (2级)                             │
│ □ 剂量-反应关系 (1级)                          │
│ □ 混杂因素负向偏倚 (1级)                        │
│                                                 │
│ 【最终GRADE等级】                               │
│ ● Medium (High 降1级)                           │
├─────────────────────────────────────────────────┤
│ 【偏倚风险评估】（适用工具）                      │
│ ☑ AMSTAR 2                                     │
│ □ Cochrane RoB 2.0                             │
│ □ QUADAS-2                                     │
│ □ SYRCLE RoB                                   │
│                                                 │
│ 【报告规范评估】                                 │
│ ☑ PRISMA 2020 (30/30条)                       │
│ □ CONSORT (25/25条)                           │
│ □ STARD 2015 (30/30条)                        │
└─────────────────────────────────────────────────┘
```

---

## 五、数据库表结构建议

### 5.1 核心表设计

```sql
-- 1. 证据类型主表
CREATE TABLE evidence_type (
    type_code VARCHAR(10) PRIMARY KEY,
    primary_category_code VARCHAR(5) NOT NULL,
    primary_category_name VARCHAR(100) NOT NULL,
    subcategory_code VARCHAR(10) NOT NULL,
    subcategory_name VARCHAR(100) NOT NULL,
    grade_initial VARCHAR(20) REFERENCES grade_level(level_code),
    ocebm_level VARCHAR(20),
    clinical_question_types TEXT,
    risk_of_bias_tool VARCHAR(50),
    reporting_guideline VARCHAR(50),
    mesh_terms TEXT,
    keywords TEXT,
    search_filters TEXT,
    hierarchy_level INT,
    created_date DATE,
    updated_date DATE,
    description TEXT
);

-- 2. 等级系统表
CREATE TABLE grade_level (
    level_code VARCHAR(20) PRIMARY KEY,
    level_name VARCHAR(50),
    description TEXT,
    order_num INT
);

-- 3. 降级因素表
CREATE TABLE downgrade_factor (
    factor_id INT PRIMARY KEY AUTO_INCREMENT,
    factor_code VARCHAR(20),
    factor_name VARCHAR(100),
    description TEXT,
    weight INT DEFAULT 1
);

-- 4. 升级因素表
CREATE TABLE upgrade_factor (
    factor_id INT PRIMARY KEY AUTO_INCREMENT,
    factor_code VARCHAR(20),
    factor_name VARCHAR(100),
    description TEXT,
    weight INT DEFAULT 1
);

-- 5. 研究文献表
CREATE TABLE research_paper (
    paper_id INT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(500),
    authors TEXT,
    journal VARCHAR(200),
    publication_date DATE,
    doi VARCHAR(100),
    pmid VARCHAR(20),

    -- 证据类型
    type_code VARCHAR(10) REFERENCES evidence_type(type_code),

    -- GRADE信息
    grade_initial VARCHAR(20) REFERENCES grade_level(level_code),
    grade_final VARCHAR(20) REFERENCES grade_level(level_code),

    -- 偏倚和报告
    risk_of_bias_assessment JSON,
    reporting_guideline_compliance JSON,

    -- 元数据
    mesh_terms TEXT,
    keywords TEXT,
    abstract TEXT,

    -- 质控信息
    created_date DATE,
    updated_date DATE,
    created_by VARCHAR(100),
    updated_by VARCHAR(100)
);

-- 6. 文献降级因素关联表
CREATE TABLE paper_downgrade_factors (
    paper_id INT REFERENCES research_paper(paper_id),
    factor_id INT REFERENCES downgrade_factor(factor_id),
    apply_level INT DEFAULT 1,
    reason TEXT,
    PRIMARY KEY (paper_id, factor_id)
);

-- 7. 文献升级因素关联表
CREATE TABLE paper_upgrade_factors (
    paper_id INT REFERENCES research_paper(paper_id),
    factor_id INT REFERENCES upgrade_factor(factor_id),
    apply_level INT DEFAULT 1,
    reason TEXT,
    PRIMARY KEY (paper_id, factor_id)
);

-- 8. 临床问题类型表
CREATE TABLE clinical_question_type (
    question_type_id INT PRIMARY KEY AUTO_INCREMENT,
    type_code VARCHAR(10),
    type_name VARCHAR(50),
    description TEXT
);

-- 9. 证据类型-临床问题关联表
CREATE TABLE evidence_type_question_mapping (
    type_code VARCHAR(10) REFERENCES evidence_type(type_code),
    question_type_id INT REFERENCES clinical_question_type(question_type_id),
    PRIMARY KEY (type_code, question_type_id)
);
```

### 5.2 初始化数据示例

```sql
-- 初始化GRADE等级
INSERT INTO grade_level VALUES
('High', 'High', 'Very confident that the true effect lies close to that of the estimate of the effect', 1),
('Moderate', 'Moderate', 'Moderately confident in the effect estimate: The true effect is likely to be close to the estimate of the effect, but there is a possibility that it is substantially different', 2),
('Low', 'Low', 'Confidence in the effect estimate is limited: The true effect may be substantially different from the estimate of the effect', 3),
('Very Low', 'Very Low', 'Very little confidence in the effect estimate: The true effect is likely to be substantially different from the estimate of effect', 4);

-- 初始化降级因素
INSERT INTO downgrade_factor VALUES
(1, 'LIMITATIONS', 'Study limitations (risk of bias)', NULL, 1),
(2, 'INCONSISTENCY', 'Inconsistency of results', NULL, 1),
(3, 'INDIRECTNESS', 'Indirectness of evidence', NULL, 1),
(4, 'IMPRECISION', 'Imprecision of effect estimates', NULL, 1),
(5, 'PUBLICATION_BIAS', 'Publication bias', NULL, 1);

-- 初始化升级因素
INSERT INTO upgrade_factor VALUES
(1, 'LARGE_EFFECT', 'Large effect size', NULL, 2),
(2, 'DOSE_RESPONSE', 'Dose-response gradient', NULL, 1),
(3, 'PLAUSIBLE_CONFOUNDING', 'Plausible confounding', NULL, 1);

-- 初始化证据类型
INSERT INTO evidence_type (type_code, primary_category_code, primary_category_name,
                          subcategory_code, subcategory_name, grade_initial,
                          ocebm_level, clinical_question_types, risk_of_bias_tool,
                          reporting_guideline, hierarchy_level, description)
VALUES
('SA01', 'SA', '系统评价与Meta分析', 'SA01', '干预性Meta分析', 'High',
 '1a', 'Treatment, Prevention, Rehabilitation', 'AMSTAR 2',
 'PRISMA 2020', 1, 'Multiple RCTs systematic review and meta-analysis on intervention'),

('R01', 'R', '实验研究', 'R01', '平行随机对照试验', 'High',
 '1b', 'Treatment, Prevention', 'Cochrane RoB 2.0',
 'CONSORT', 2, 'Parallel-group randomized controlled trial'),

('O01', 'O', '观察性研究', 'O01', '前瞻性队列研究', 'Low',
 '2a', 'Prognosis, Harm, Etiology', 'ROBINS-I, NOS',
 'STROBE', 3, 'Prospective cohort study');

-- 初始化临床问题类型
INSERT INTO clinical_question_type (type_code, type_name, description) VALUES
('TREATMENT', '治疗/预防', 'Therapeutic or preventive interventions'),
('DIAGNOSIS', '诊断', 'Diagnostic accuracy tests'),
('PROGNOSIS', '预后', 'Prognostic factors and outcomes'),
('HARM', '危害/病因', 'Risk factors and harm, etiology'),
('ECONOMICS', '经济学评价', 'Cost-effectiveness and economic evaluations');

-- 建立关联关系
INSERT INTO evidence_type_question_mapping (type_code, question_type_id) VALUES
('SA01', 1), -- SA01 -> Treatment
('SA01', 5), -- SA01 -> Economics
('R01', 1),  -- R01 -> Treatment
('O01', 3),  -- O01 -> Prognosis
('O01', 4);  -- O01 -> Harm
```

---

## 六、证据类型完整参考清单（汇总表）

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         证据类型完整参考清单                                  │
├──────────┬──────────────┬───────────────────────────┬──────────┬──────────┤
│ Type     │ 名称          │ 包含子类型                │ GRADE    │ OCEBM    │
├──────────┼──────────────┼───────────────────────────┼──────────┼──────────┤
│ SA       │ 系统评价      │ SA01-SA08 (8种)          │ High     │ 1a-5     │
│ R        │ 实验研究      │ R01-R06 (6种)            │ High     │ 1b-2b    │
│ O        │ 观察性研究    │ O01-O08 (8种)            │ Low      │ 2a-4     │
│ D        │ 诊断性研究    │ D01-D05 (5种)            │ Low-Mid  │ 1b-2a    │
│ P        │ 预后研究      │ P01-P05 (5种)            │ Low-Mid  │ 2a       │
│ H        │ 危害研究      │ H01-H05 (5种)            │ Low-Mid  │ 1b-3b    │
│ HE       │ 经济学研究    │ HE01-HE05 (5种)          │ Low-Mid  │ 2a-3b    │
│ C        │ 临床指南      │ C01-C03 (3种)            │ Mid-High │ -        │
│ B        │ 基础科学      │ B01-B04 (4种)            │ Very Low │ 5        │
│ OJ       │ 专家意见      │ OJ01-OJ03 (3种)          │ Very Low │ 5        │
│ RE       │ 叙述性综述    │ RE01-RE02 (2种)          │ -        │ -        │
├──────────┴──────────────┴───────────────────────────┴──────────┴──────────┤
│ 合计: 11个主分类，涵盖 55+ 种具体证据类型                                       │
└─────────────────────────────────────────────────────────────────────────────┘

各类型证据金字塔层级:
Level 1: SA (系统评价)
Level 2: R (实验研究/RCT)
Level 3: D (诊断研究), P (预后研究), O (部分观察性研究)
Level 4: H (危害研究), HE (经济学研究)
Level 5: B (基础科学), OJ (专家意见)
Level 6: RE (叙述性综述, 不分级)

注: 实际级别可能根据质量评估上下调整
```

此规范为您的循证医学文献管理系统提供了完整的Type定义架构，涵盖了从最高级别的系统评价/Meta分析到最低级别的专家意见的完整证据类型体系，同时整合了GRADE等主流证据分级系统。
