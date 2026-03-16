/**
 * 病历生成器选项
 */
export interface CaseGeneratorOptions {
    /** 科室类型，如：呼吸内科、消化内科、心内科等 */
    department?: string;
    /** 疾病类型，如：肺炎、胃炎、冠心病等 */
    disease?: string;
    /** 患者姓名（可选，不传则随机生成） */
    patientName?: string;
    /** 患者年龄范围 */
    ageRange?: {
        min: number;
        max: number;
    };
    /** 性别（可选，不传则随机） */
    gender?: "男" | "女";
    /** 病例分型：A/B/C/D */
    caseType?: "A型" | "B型" | "C型" | "D型";
    /** 是否生成脱敏版本 */
    anonymize?: boolean;
}

/**
 * 生成的病历结果
 */
export interface GeneratedCase {
    /** 病历内容（Markdown格式） */
    content: string;
    /** 病历元数据 */
    metadata: {
        /** 科室 */
        department: string;
        /** 疾病 */
        disease: string;
        /** 病例分型 */
        caseType: "A型" | "B型" | "C型" | "D型";
        /** 生成时间 */
        generatedAt: string;
    };
}

/**
 * 科室及疾病模板
 */
export interface DepartmentTemplate {
    /** 科室名称 */
    name: string;
    /** 常见疾病 */
    diseases: DiseaseTemplate[];
}

/**
 * 疾病模板
 */
export interface DiseaseTemplate {
    /** 疾病名称 */
    name: string;
    /** 主要症状 */
    mainSymptoms: string[];
    /** 伴随症状 */
    accompanyingSymptoms: string[];
    /** 典型体征 */
    typicalSigns: string[];
    /** 辅助检查异常项 */
    abnormalExams: string[];
    /** 诊断依据要点 */
    diagnosticPoints: string[];
    /** 鉴别诊断 */
    differentialDiagnoses: string[];
    /** 诊疗计划要点 */
    treatmentPlan: string[];
}
