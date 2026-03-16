/**
 * 一般项目 - 患者基本信息
 */
export interface CommonItems {
    /** 姓名 */
    name?: string;
    /** 性别 */
    gender?: "男" | "女" | "其他";
    /** 年龄 */
    age?: number;
    /** 民族 */
    ethnicity?: string;
    /** 婚姻状况 */
    maritalStatus?: "未婚" | "已婚" | "离异" | "丧偶" | "其他";
    /** 出生地 */
    birthplace?: string;
    /** 职业 */
    occupation?: string;
    /** 工作单位 */
    employer?: string;
    /** 住址 */
    address?: string;
    /** 入院时间 */
    admissionTime?: string;
    /** 入院方式 */
    admissionMethod?: "步行" | "轮椅" | "抱送" | "担架" | "其他";
    /** 记录时间 */
    recordTime?: string;
    /** 病史陈述者 */
    historian?: string;
}

/**
 * 主诉
 */
export interface ChiefComplaint {
    /** 主诉内容 */
    content?: string;
    /** 主要症状 */
    mainSymptoms?: string[];
}

/**
 * 现病史 - 发病情况
 */
export interface OnsetInfo {
    /** 发病诱因 */
    precipitatingFactor?: string;
    /** 发病时间 */
    onsetTime?: string;
    /** 发病缓急 */
    onsetPattern?: "急" | "缓" | "急缓交替";
}

/**
 * 主要症状
 */
export interface PrimarySymptom {
    /** 症状名称 */
    name?: string;
    /** 强度 */
    intensity?: string;
    /** 类型 */
    type?: string;
    /** 部位 */
    location?: string;
    /** 性状 */
    character?: string;
    /** 次数 */
    frequency?: string;
    /** 缓急 */
    urgency?: string;
    /** 时间 */
    duration?: string;
    /** 加重或缓解因素 */
    aggravatingRelievingFactors?: string;
}

/**
 * 伴随症状
 */
export interface AccompanyingSymptom {
    /** 症状描述 */
    description?: string;
    /** 与主要症状的关系 */
    relationshipWithPrimary?: string;
    /** 阳性症状（存在） */
    positiveSymptoms?: string[];
    /** 阴性症状（不存在，用于鉴别诊断） */
    negativeSymptoms?: string[];
}

/**
 * 诊疗经过 - 医疗机构信息
 */
export interface MedicalInstitutionInfo {
    /** 机构名称 */
    name?: string;
    /** 就诊时间 */
    visitTime?: string;
    /** 诊断 */
    diagnosis?: string;
}

/**
 * 辅助检查结果
 */
export interface AuxiliaryExamResult {
    /** 检查项目 */
    item?: string;
    /** 检查时间 */
    examTime?: string;
    /** 检查机构 */
    institution?: string;
    /** 检查结果 */
    result?: string;
    /** 检查结论 */
    conclusion?: string;
}

/**
 * 药物治疗情况
 */
export interface MedicationTreatment {
    /** 药物类型 */
    drugType?: string;
    /** 用药名称 */
    drugName?: string;
    /** 用量 */
    dosage?: string;
    /** 用药方法 */
    administrationMethod?: string;
    /** 疗程 */
    courseOfTreatment?: string;
    /** 疗效及病情演变 */
    efficacyAndOutcome?: string;
}

/**
 * 手术治疗情况
 */
export interface SurgicalTreatment {
    /** 手术名称/术式 */
    surgicalMethod?: string;
    /** 手术时间 */
    surgeryTime?: string;
    /** 手术机构 */
    institution?: string;
    /** 疗效及病情演变 */
    efficacyAndOutcome?: string;
}

/**
 * 诊疗经过
 */
export interface TreatmentHistory {
    /** 诊疗机构信息 */
    institutions?: MedicalInstitutionInfo[];
    /** 辅助检查情况及结果 */
    auxiliaryExamResults?: AuxiliaryExamResult[];
    /** 药物治疗 */
    medicationTreatments?: MedicationTreatment[];
    /** 手术治疗 */
    surgicalTreatments?: SurgicalTreatment[];
}

/**
 * 发病以来的一般情况
 */
export interface GeneralConditionSinceOnset {
    /** 饮食 */
    diet?: string;
    /** 睡眠 */
    sleep?: string;
    /** 大便 */
    bowelMovement?: string;
    /** 小便 */
    urination?: string;
    /** 体重 */
    weight?: string;
    /** 精神状态 */
    mentalState?: string;
}

/**
 * 现病史
 */
export interface PresentIllness {
    /** 发病情况 */
    onsetInfo?: OnsetInfo;
    /** 主要症状 */
    primarySymptoms?: PrimarySymptom[];
    /** 伴随症状 */
    accompanyingSymptoms?: AccompanyingSymptom;
    /** 诊疗经过 */
    treatmentHistory?: TreatmentHistory;
    /** 发病以来的一般情况 */
    generalCondition?: GeneralConditionSinceOnset;
}

/**
 * 疾病史及诊疗史
 */
export interface DiseaseHistoryItem {
    /** 疾病名称 */
    diseaseName?: string;
    /** 诊断时间 */
    diagnosisTime?: string;
    /** 诊断机构 */
    diagnosisInstitution?: string;
    /** 治疗情况 */
    treatment?: string;
    /** 疗效 */
    outcome?: string;
}

/**
 * 过敏史
 */
export interface AllergyHistory {
    /** 过敏原 */
    allergen?: string;
    /** 过敏表现 */
    allergicReaction?: string;
}

/**
 * 传染病史
 */
export interface InfectiousDiseaseHistory {
    /** 结核病史 */
    tuberculosis?: string;
    /** 乙肝病史 */
    hepatitisB?: string;
    /** 其他传染病 */
    other?: string;
}

/**
 * 既往史
 */
export interface PastHistory {
    /** 疾病史及诊疗史 */
    diseaseHistory?: DiseaseHistoryItem[];
    /** 过敏史 */
    allergies?: AllergyHistory[];
    /** 手术外伤史 */
    surgeryTraumaHistory?: string;
    /** 传染病史 */
    infectiousDiseaseHistory?: InfectiousDiseaseHistory;
    /** 冶游史 */
    sexualHistory?: string;
    /** 疫水接触史 */
    epidemicWaterExposure?: string;
    /** 预防接种史 */
    vaccinationHistory?: string;
}

/**
 * 系统回顾 - 呼吸系统
 */
export interface RespiratorySystem {
    /** 咳嗽、咳痰 */
    coughSputum?: string;
    /** 呼吸困难、喘息 */
    dyspneaWheezing?: string;
    /** 咯血 */
    hemoptysis?: string;
    /** 低热 */
    lowGradeFever?: string;
    /** 胸痛 */
    chestPain?: string;
    /** 盗汗 */
    nightSweats?: string;
}

/**
 * 系统回顾 - 循环系统
 */
export interface CirculatorySystem {
    /** 心悸 */
    palpitations?: string;
    /** 活动后气促 */
    exertionalDyspnea?: string;
    /** 头痛 */
    headache?: string;
    /** 晕厥 */
    syncope?: string;
    /** 血压升高 */
    hypertension?: string;
    /** 心前区疼痛 */
    precordialPain?: string;
    /** 水肿 */
    edema?: string;
}

/**
 * 系统回顾 - 消化系统
 */
export interface DigestiveSystem {
    /** 食欲减退 */
    anorexia?: string;
    /** 反酸、嗳气 */
    acidRefluxBurping?: string;
    /** 恶心、呕吐 */
    nauseaVomiting?: string;
    /** 腹胀、腹痛、腹泻、便秘 */
    abdominalSymptoms?: string;
    /** 呕血、黑便 */
    hematemesisMelena?: string;
    /** 黄疸 */
    jaundice?: string;
}

/**
 * 系统回顾 - 泌尿生殖系统
 */
export interface GenitourinarySystem {
    /** 尿频、尿急、尿痛、排尿困难 */
    urinarySymptoms?: string;
    /** 尿量改变 */
    urineVolumeChange?: string;
    /** 尿的颜色改变 */
    urineColorChange?: string;
    /** 尿失禁 */
    urinaryIncontinence?: string;
    /** 水肿 */
    edema?: string;
}

/**
 * 系统回顾 - 造血系统
 */
export interface HematopoieticSystem {
    /** 乏力、头晕、眼花 */
    fatigueDizziness?: string;
    /** 皮肤粘膜苍白、黄染、出血点、瘀斑 */
    skinMucosalChanges?: string;
    /** 鼻出血、皮下出血、骨痛 */
    bleedingBonePain?: string;
}

/**
 * 系统回顾 - 内分泌及代谢系统
 */
export interface EndocrineMetabolicSystem {
    /** 食欲亢进 */
    polyphagia?: string;
    /** 畏寒怕热、多汗 */
    thermoregulation?: string;
    /** 多饮多尿 */
    polydipsiaPolyuria?: string;
    /** 双手震颤 */
    handTremor?: string;
    /** 性格改变、体重改变 */
    behavioralChanges?: string;
}

/**
 * 系统回顾 - 神经精神系统
 */
export interface NeuropsychiatricSystem {
    /** 头痛、头晕、晕厥 */
    headacheDizziness?: string;
    /** 失眠、意识障碍 */
    sleepConsciousness?: string;
    /** 颤动、抽搐、瘫痪、感觉异常 */
    motorSensory?: string;
    /** 记忆力减退、视力障碍、情绪状态、智力改变 */
    cognitiveVisual?: string;
}

/**
 * 系统回顾 - 运动系统
 */
export interface MusculoskeletalSystem {
    /** 关节红、肿、疼痛 */
    jointSymptoms?: string;
    /** 肢体肌肉麻木、震颤、痉挛、萎缩 */
    muscleSymptoms?: string;
}

/**
 * 系统回顾
 */
export interface SystemReview {
    /** 呼吸系统 */
    respiratory?: RespiratorySystem;
    /** 循环系统 */
    circulatory?: CirculatorySystem;
    /** 消化系统 */
    digestive?: DigestiveSystem;
    /** 泌尿生殖系统 */
    genitourinary?: GenitourinarySystem;
    /** 造血系统 */
    hematopoietic?: HematopoieticSystem;
    /** 内分泌及代谢系统 */
    endocrineMetabolic?: EndocrineMetabolicSystem;
    /** 神经精神系统 */
    neuropsychiatric?: NeuropsychiatricSystem;
    /** 运动系统 */
    musculoskeletal?: MusculoskeletalSystem;
}

/**
 * 个人史 - 不良嗜好
 */
export interface BadHabits {
    /** 吸烟史 */
    smoking?: {
        /** 是否吸烟 */
        isSmoker?: boolean;
        /** 吸烟年限 */
        years?: number;
        /** 每日吸烟量 */
        dailyAmount?: number;
        /** 是否戒烟 */
        quitSmoking?: boolean;
        /** 戒烟年限 */
        quitYears?: number;
    };
    /** 饮酒史 */
    alcohol?: {
        /** 是否饮酒 */
        isDrinker?: boolean;
        /** 饮酒年限 */
        years?: number;
        /** 饮酒量 */
        amount?: string;
        /** 是否戒酒 */
        quitDrinking?: boolean;
    };
    /** 其他不良嗜好 */
    others?: string;
}

/**
 * 个人史
 */
export interface PersonalHistory {
    /** 居住地 */
    residence?: string;
    /** 不良嗜好史 */
    badHabits?: BadHabits;
    /** 婚育史 */
    maritalFertilityHistory?: string;
    /** 职业暴露史 */
    occupationalExposure?: string;
}

/**
 * 月经史
 */
export interface MenstrualHistory {
    /** 初潮年龄 */
    menarcheAge?: number;
    /** 绝经年龄 */
    menopauseAge?: number;
    /** 月经周期 */
    menstrualCycle?: string;
    /** 经期 */
    menstrualPeriod?: string;
    /** 月经量 */
    menstrualFlow?: "多" | "中" | "少";
    /** 月经颜色 */
    menstrualColor?: string;
    /** 是否有血块 */
    clots?: boolean;
    /** 痛经 */
    dysmenorrhea?: boolean;
}

/**
 * 婚育史
 */
export interface MaritalFertilityHistory {
    /** 结婚年龄 */
    marriageAge?: number;
    /** 孕次 */
    gravida?: number;
    /** 产次 */
    para?: number;
    /** 流产次数 */
    abortion?: number;
    /** 子女情况 */
    childrenStatus?: string;
    /** 配偶健康状况 */
    spouseHealth?: string;
}

/**
 * 月经婚育史
 */
export interface MenstrualMaritalHistory {
    /** 月经史 */
    menstrual?: MenstrualHistory;
    /** 婚育史 */
    maritalFertility?: MaritalFertilityHistory;
}

/**
 * 家族成员健康状况
 */
export interface FamilyMemberHealth {
    /** 成员关系 */
    relationship?: string;
    /** 健康状况 */
    healthStatus?: string;
    /** 死亡原因（如已死亡） */
    causeOfDeath?: string;
    /** 死亡时年龄（如已死亡） */
    ageAtDeath?: number;
}

/**
 * 家族史
 */
export interface FamilyHistory {
    /** 家族成员健康状况 */
    familyMembers?: FamilyMemberHealth[];
    /** 家族传染病史（如结核、肝炎、性病） */
    infectiousDiseaseHistory?: string;
    /** 家族遗传性疾病（如血友病、白化病等） */
    hereditaryDiseases?: string;
}

/**
 * 体格检查 - 生命体征
 */
export interface VitalSigns {
    /** 体温 */
    temperature?: string;
    /** 脉搏 */
    pulse?: string;
    /** 呼吸 */
    respiration?: string;
    /** 血压 */
    bloodPressure?: string;
    /** 身高 */
    height?: string;
    /** 体重 */
    weight?: string;
    /** 体重指数 */
    bmi?: string;
    /** 经皮血氧饱和度 */
    spo2?: string;
}

/**
 * 体格检查 - 一般情况
 */
export interface GeneralPhysicalExam {
    /** 发育 */
    development?: string;
    /** 营养 */
    nutrition?: string;
    /** 面容 */
    facialExpression?: string;
    /** 神志 */
    consciousness?: string;
    /** 精神 */
    mentalState?: string;
    /** 体位 */
    posture?: string;
    /** 配合检查 */
    cooperation?: string;
}

/**
 * 体格检查 - 皮肤粘膜
 */
export interface SkinMucosa {
    /** 皮肤粘膜情况 */
    description?: string;
    /** 黄染 */
    jaundice?: boolean;
    /** 出血点 */
    petechiae?: boolean;
    /** 其他 */
    others?: string;
}

/**
 * 体格检查 - 淋巴结
 */
export interface LymphNodes {
    /** 浅表淋巴结 */
    superficial?: string;
    /** 肿大淋巴结描述 */
    enlargedDescription?: string;
}

/**
 * 体格检查 - 头颈部
 */
export interface HeadNeck {
    /** 头颅 */
    head?: string;
    /** 眼 */
    eyes?: string;
    /** 耳 */
    ears?: string;
    /** 鼻 */
    nose?: string;
    /** 口唇 */
    lips?: string;
    /** 口腔 */
    oral?: string;
    /** 咽 */
    pharynx?: string;
    /** 颈部 */
    neck?: string;
}

/**
 * 体格检查 - 胸部
 */
export interface Chest {
    /** 胸廓 */
    chest?: string;
    /** 呼吸动度 */
    respiratoryMotion?: string;
    /** 语颤 */
    vocalFremitus?: string;
    /** 肺部叩诊 */
    lungPercussion?: string;
    /** 呼吸音 */
    breathSounds?: string;
    /** 啰音 */
    rales?: string;
    /** 心脏 */
    heart?: string;
}

/**
 * 体格检查 - 腹部
 */
export interface Abdomen {
    /** 腹部外观 */
    appearance?: string;
    /** 腹壁静脉 */
    abdominalVeins?: string;
    /** 胃肠型及蠕动波 */
    peristalticWaves?: string;
    /** 压痛 */
    tenderness?: string;
    /** 反跳痛 */
    reboundTenderness?: string;
    /** 腹肌紧张 */
    muscleTension?: string;
    /** 腹部包块 */
    masses?: string;
    /** 肝脾 */
    liverSpleen?: string;
    /** 移动性浊音 */
    shiftingDullness?: string;
    /** 肾区叩击痛 */
    kidneyPercussion?: string;
    /** 肠鸣音 */
    bowelSounds?: string;
}

/**
 * 体格检查 - 四肢
 */
export interface Extremities {
    /** 脊柱 */
    spine?: string;
    /** 四肢 */
    limbs?: string;
    /** 关节 */
    joints?: string;
    /** 杵状指 */
    clubbing?: string;
    /** 水肿 */
    edema?: string;
}

/**
 * 体格检查 - 神经系统
 */
export interface NervousSystem {
    /** 肌力 */
    muscleStrength?: string;
    /** 肌张力 */
    muscleTone?: string;
    /** 反射 */
    reflexes?: string;
    /** 病理征 */
    pathologicalSigns?: string;
    /** 感觉 */
    sensation?: string;
}

/**
 * 体格检查
 */
export interface PhysicalExam {
    /** 生命体征 */
    vitalSigns?: VitalSigns;
    /** 一般情况 */
    general?: GeneralPhysicalExam;
    /** 皮肤粘膜 */
    skinMucosa?: SkinMucosa;
    /** 淋巴结 */
    lymphNodes?: LymphNodes;
    /** 头颈部 */
    headNeck?: HeadNeck;
    /** 胸部 */
    chest?: Chest;
    /** 腹部 */
    abdomen?: Abdomen;
    /** 四肢 */
    extremities?: Extremities;
    /** 神经系统 */
    nervousSystem?: NervousSystem;
}

/**
 * 实验室检查项目
 */
export interface LabExamItem {
    /** 检查项目名称 */
    itemName?: string;
    /** 检查时间 */
    examTime?: string;
    /** 检查机构 */
    institution?: string;
    /** 检查结果 */
    result?: string;
    /** 正常参考值 */
    referenceValue?: string;
    /** 异常标志 */
    abnormalFlag?: "↑" | "↓" | "正常";
}

/**
 * 实验室检查
 */
export interface LaboratoryExam {
    /** 血常规 */
    bloodRoutine?: LabExamItem[];
    /** 尿常规 */
    urineRoutine?: LabExamItem[];
    /** 粪常规 */
    stoolRoutine?: LabExamItem[];
    /** 肝功能 */
    liverFunction?: LabExamItem[];
    /** 肾功能 */
    renalFunction?: LabExamItem[];
    /** 电解质 */
    electrolytes?: LabExamItem[];
    /** 血糖 */
    bloodGlucose?: LabExamItem[];
    /** 血脂 */
    bloodLipid?: LabExamItem[];
    /** 心肌酶 */
    cardiacEnzymes?: LabExamItem[];
    /** 凝血功能 */
    coagulationFunction?: LabExamItem[];
    /** 感染指标 */
    infectionMarkers?: LabExamItem[];
    /** 肿瘤标志物 */
    tumorMarkers?: LabExamItem[];
    /** 其他 */
    others?: LabExamItem[];
}

/**
 * 辅助检查项目
 */
export interface AuxiliaryExamItem {
    /** 检查项目名称 */
    itemName?: string;
    /** 检查时间 */
    examTime?: string;
    /** 检查机构 */
    institution?: string;
    /** 检查结果 */
    result?: string;
    /** 检查结论 */
    conclusion?: string;
    /** 影像资料描述 */
    imagingDescription?: string;
}

/**
 * 辅助检查
 */
export interface AuxiliaryExam {
    /** 心电图 */
    ecg?: AuxiliaryExamItem[];
    /** 心脏彩超 */
    echocardiography?: AuxiliaryExamItem[];
    /** 腹部B超 */
    abdominalUltrasound?: AuxiliaryExamItem[];
    /** CT */
    ct?: AuxiliaryExamItem[];
    /** MRI */
    mri?: AuxiliaryExamItem[];
    /** X线 */
    xray?: AuxiliaryExamItem[];
    /** 内镜检查 */
    endoscopy?: AuxiliaryExamItem[];
    /** 其他 */
    others?: AuxiliaryExamItem[];
}

/**
 * 病历摘要
 */
export interface CaseSummary {
    /** 临床表现 */
    clinicalManifestations?: string;
    /** 体格检查 */
    physicalExam?: string;
    /** 辅助检查 */
    auxiliaryExam?: string;
    /** 摘要全文 */
    fullText?: string;
}

/**
 * 诊断依据
 */
export interface DiagnosticEvidence {
    /** 依据描述 */
    description?: string;
}

/**
 * 诊断
 */
export interface Diagnosis {
    /** 诊断名称 */
    diagnosisName?: string;
    /** 诊断类型（主要诊断/次要诊断） */
    diagnosisType?: "主要诊断" | "次要诊断" | "并发症";
    /** 诊断依据 */
    evidences?: DiagnosticEvidence[];
}

/**
 * 鉴别诊断
 */
export interface DifferentialDiagnosis {
    /** 需要鉴别的疾病 */
    diseases?: string[];
    /** 鉴别要点 */
    keyPoints?: string;
}

/**
 * 病历分型
 */
export interface CaseClassification {
    /** 分型 */
    type?: "A型" | "B型" | "C型" | "D型";
    /** 分型说明 */
    description?: string;
}

/**
 * 诊疗计划
 */
export interface TreatmentPlan {
    /** 计划内容 */
    content?: string[];
    /** 详细说明 */
    detailedPlan?: string;
}

/**
 * 医师签名
 */
export interface PhysicianSignature {
    /** 医师姓名 */
    name?: string;
    /** 签名时间 */
    signTime?: string;
}

/**
 * 完整病历
 */
export interface ClinicalCaseComplete {
    /** 一般项目 */
    commonItems?: CommonItems;
    /** 主诉 */
    chiefComplaint?: ChiefComplaint;
    /** 现病史 */
    presentIllness?: PresentIllness;
    /** 既往史 */
    pastHistory?: PastHistory;
    /** 系统回顾 */
    systemReview?: SystemReview;
    /** 个人史 */
    personalHistory?: PersonalHistory;
    /** 月经婚育史 */
    menstrualMaritalHistory?: MenstrualMaritalHistory;
    /** 家族史 */
    familyHistory?: FamilyHistory;
    /** 体格检查 */
    physicalExam?: PhysicalExam;
    /** 实验室检查 */
    laboratoryExam?: LaboratoryExam;
    /** 辅助检查 */
    auxiliaryExam?: AuxiliaryExam;
    /** 病历摘要 */
    caseSummary?: CaseSummary;
    /** 诊断 */
    diagnoses?: Diagnosis[];
    /** 鉴别诊断 */
    differentialDiagnosis?: DifferentialDiagnosis;
    /** 病历分型 */
    caseClassification?: CaseClassification;
    /** 诊疗计划 */
    treatmentPlan?: TreatmentPlan;
    /** 医师签名 */
    physicianSignature?: PhysicianSignature;
}
