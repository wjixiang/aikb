/**
 * 病历生成提示词
 */

/**
 * 生成完整的病历生成提示词（简化版）
 */
export function generateCasePrompt(params: {
    department: string;
    disease: string;
    diseaseInfo: {
        mainSymptoms: string[];
        accompanyingSymptoms: string[];
        typicalSigns: string[];
        abnormalExams: string[];
        diagnosticPoints: string[];
        differentialDiagnoses: string[];
        treatmentPlan: string[];
    };
    patientName: string;
    age: number;
    gender: "男" | "女";
    caseType: "A型" | "B型" | "C型" | "D型";
}): string {
    const { department, disease, diseaseInfo, patientName, age, gender, caseType } = params;

    return `请生成一份${department}的住院病历（${disease}）。

患者信息：${gender}性，${age}岁

主要症状：${diseaseInfo.mainSymptoms.join("、")}
伴随症状：${diseaseInfo.accompanyingSymptoms.join("、")}
典型体征：${diseaseInfo.typicalSigns.join("、")}
辅助检查异常：${diseaseInfo.abnormalExams.join("；")}
诊断依据：${diseaseInfo.diagnosticPoints.join("；")}
鉴别诊断：${diseaseInfo.differentialDiagnoses.join("、")}
诊疗计划：${diseaseInfo.treatmentPlan.join("；")}

病例分型：${caseType}

请按以下格式生成完整的住院病历（脱敏处理，姓名用***）：
姓名:***        出生地:湖南省长沙市XX区
性别：${gender}           民族:汉族
职业：工人         年龄:${age}岁
婚姻：已婚         住址：湖南省长沙市XX区
入院日期：2025年XX月XX日 XX时XX分      记录日期:2025年XX月XX日 XX时XX分
病情陈述者:患者本人   入院方式:步行
主诉：XXX
现病史：患者自述...
既往史：...
个人史：...
婚姻生育史:...
家族史:...
体格检查：...
专科情况：...
辅助检查：...
病例摘要：...
诊断依据：...
鉴别诊断：...
初步诊断：...
病例分型：${caseType}
诊疗计划：...
医生签名：***`;
}

/**
 * 生成脱敏病历的提示词
 */
export function generateAnonymizedCasePrompt(params: {
    department: string;
    disease: string;
    diseaseInfo: {
        mainSymptoms: string[];
        accompanyingSymptoms: string[];
        typicalSigns: string[];
        abnormalExams: string[];
        diagnosticPoints: string[];
        differentialDiagnoses: string[];
        treatmentPlan: string[];
    };
    age: number;
    gender: "男" | "女";
    caseType: "A型" | "B型" | "C型" | "D型";
}): string {
    const { department, disease, diseaseInfo, age, gender, caseType } = params;

    return `请生成一份${department}的住院病历（${disease}），只需生成主要框架内容，不需要太详细。

患者信息：${gender}性，${age}岁

主要症状：${diseaseInfo.mainSymptoms.join("、")}
伴随症状：${diseaseInfo.accompanyingSymptoms.join("、")}
典型体征：${diseaseInfo.typicalSigns.join("、")}
辅助检查异常：${diseaseInfo.abnormalExams.join("；")}
诊断依据：${diseaseInfo.diagnosticPoints.join("；")}
鉴别诊断：${diseaseInfo.differentialDiagnoses.join("、")}
诊疗计划：${diseaseInfo.treatmentPlan.join("；")}

病例分型：${caseType}

请按以下简化格式生成住院病历：
姓名:***        出生地:湖南省长沙市XX区
性别：${gender}           民族:汉族
职业：工人         年龄:${age}岁
婚姻：已婚         住址：湖南省长沙市XX区
入院日期：2025年XX月XX日      记录日期:2025年XX月XX日
主诉：XXX
现病史：患者自述...（简述发病过程、诊疗经过、一般情况）
既往史：既往体健，否认...
个人史：...
家族史:...
体格检查：体温:36.5℃，脉搏:80次/分，呼吸:18次/分，血压:120/80mmHg...
辅助检查：...
病例摘要：...
诊断依据：...
鉴别诊断：...
初步诊断：1.XXX
病例分型：${caseType}
诊疗计划：...
医生签名：***`;
}
