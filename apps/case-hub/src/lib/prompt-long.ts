/**
 * 病历生成提示词 - 长病历版本
 */

/**
 * 生成一般项目、主诉、现病史
 */
export function generatePart1(params: {
    department: string;
    disease: string;
    diseaseInfo: {
        mainSymptoms: string[];
        accompanyingSymptoms: string[];
    };
    age: number;
    gender: "男" | "女";
    patientName: string;
    address: string;
}): string {
    const { department, disease, diseaseInfo, age, gender, patientName, address } = params;

    return `请生成${department}住院病历的第一部分（一般项目+主诉+现病史）。

患者信息：
- 姓名：${patientName}
- 性别：${gender}
- 年龄：${age}岁

疾病特征：
- 主要症状：${diseaseInfo.mainSymptoms.join("、")}
- 伴随症状：${diseaseInfo.accompanyingSymptoms.join("、")}

要求：
1. 用陈述性语言详细描述发病过程
2. 现病史需包含：发病时间、诱因、症状特点、诊疗经过、伴随症状，一般情况（饮食、睡眠，大小便，体重、精神）
3. 参考格式（必须遵循）：

姓名:${patientName}        出生地:${address}
性别：${gender}           民族:汉族
职业：工人/农民/教师/职员等         年龄:${age}岁
婚姻：已婚         住址：${address}
入院日期：2025年X月X日X时X分      记录日期:2025年X月X日X时X分
病情陈述者:患者本人   入院方式:步行
主诉：XXX（症状+时间）
现病史：患者自2025年X月X日（详细描述发病过程，至少200字，包括诊疗经过、病情变化、伴随症状、一般情况）

注意：
1. 姓名用***代替保护隐私
2. 只生成这部分内容，不要生成其他部分`;
}

/**
 * 生成既往史、个人史、婚姻生育史、家族史
 */
export function generatePart2(params: {
    diseaseInfo: {
        typicalSigns: string[];
    };
}): string {
    const { diseaseInfo } = params;

    return `请生成住院病历的第二部分（既往史+个人史+婚姻生育史+家族史）。

典型体征参考：${diseaseInfo.typicalSigns.join("、")}

要求：
1. 既往史需包含：疾病史、过敏史、手术外伤史、传染病史（结核、乙肝等）、预防接种史
2. 个人史需包含：出生地、居住史、烟酒史、疫水接触史、职业暴露
3. 婚姻生育史：婚姻状况、配偶健康、子女情况
4. 家族史：父母、兄弟姐妹健康状况、遗传病史、传染病史

参考格式：
既往史：患者既往体健，否认高血压，糖尿病、冠心病史，否认肝炎、结核病史，否认手术外伤史，否认食物药物过敏史...
个人史：出生湖南省，久居本地，否认血吸虫疫水接触史，吸烟X年/否认吸烟史，饮酒X年/否认饮酒史...
婚姻生育史:已婚，适龄结婚，子女体健...
家族史: 父:健在 母:健在 兄弟姐妹:健在 否认传染病及遗传病家族史

注意：只需要生成这部分内容，不要生成其他部分。`;
}

/**
 * 生成体格检查
 */
export function generatePart3(): string {
    return `请生成住院病历的第三部分（体格检查）。

要求：
1. 按系统描述：生命体征，一般情况、皮肤粘膜、淋巴结、头颈部、胸腹、四肢、神经系统
2. 使用陈述性语言，详细描述阳性体征和重要的阴性体征
3. 数值需合理（体温36-37℃，脉搏60-100次/分，呼吸16-20次/分，血压90-140/60-90mmHg）

参考格式：
体格检查：体温:36.5℃，脉搏:80次/分，呼吸:18次/分，血压:120/80mmHg，发育正常，营养良好，正常面容，神志清晰，精神尚可，自动体位，查体合作...（详细描述各系统检查结果，至少300字）

注意：只需要生成体格检查部分内容，不要生成其他部分。`;
}

/**
 * 生成专科情况、辅助检查
 */
export function generatePart4(params: {
    diseaseInfo: {
        abnormalExams: string[];
    };
}): string {
    const { diseaseInfo } = params;

    return `请生成住院病历的第四部分（专科情况+辅助检查）。

辅助检查异常项参考：${diseaseInfo.abnormalExams.join("；")}

要求：
1. 专科情况：描述本专科相关的体征
2. 辅助检查：包含血常规、肝肾功能、电解质、凝血功能、相关专科检查等，结果需符合疾病特征

参考格式：
专科情况：XXX...

辅助检查：2025-XX-XX我院:【血常规】XXX；【肝肾功能】XXX；【电解质】XXX...（详细列出检查结果，至少200字）

注意：只需要生成这部分内容，不要生成其他部分。`;
}

/**
 * 生成病例摘要、诊断依据、鉴别诊断、初步诊断、诊疗计划
 */
export function generatePart5(params: {
    department: string;
    disease: string;
    diseaseInfo: {
        diagnosticPoints: string[];
        differentialDiagnoses: string[];
        treatmentPlan: string[];
    };
    age: number;
    gender: "男" | "女";
    caseType: "A型" | "B型" | "C型" | "D型";
}): string {
    const { department, disease, diseaseInfo, age, gender, caseType } = params;

    return `请生成住院病历的第五部分（病例摘要+诊断依据+鉴别诊断+初步诊断+病例分型+诊疗计划+医生签名）。

患者信息：
- 性别：${gender}
- 年龄：${age}岁

诊断相关信息：
- 科室：${department}
- 疾病：${disease}
- 诊断依据要点：${diseaseInfo.diagnosticPoints.join("；")}
- 鉴别诊断：${diseaseInfo.differentialDiagnoses.join("、")}
- 诊疗计划要点：${diseaseInfo.treatmentPlan.join("；")}
- 病例分型：${caseType}

要求：
1. 病例摘要：简明扼要概括病史、体检、辅助检查的阳性和重要阴性结果（100字内）
2. 诊断依据：列出支持诊断的证据
3. 鉴别诊断：列出需要鉴别的疾病及鉴别要点
4. 初步诊断：列出主要诊断和次要诊断
5. 病例分型：${caseType}
6. 诊疗计划：详细描述检查和治疗计划
7. 医生签名：***

参考格式：
病例摘要：患者${gender}，${age}岁，因XXX入院...（摘要全文）

诊断依据：1、XXX...2、XXX...3、XXX...

鉴别诊断：1、XXX：...2、XXX：...

初步诊断：1、XXX 2、XXX...

病例分型：${caseType}

诊疗计划：1、XXX 2、XXX...（详细计划）

医生签名：***

注意：只需要生成这部分内容，不要生成其他部分。`;
}
