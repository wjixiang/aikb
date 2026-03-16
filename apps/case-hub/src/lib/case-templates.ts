/**
 * 科室及疾病模板定义
 */
import type { DepartmentTemplate } from "../types/generator.type.js";

/**
 * 常用姓氏列表
 */
export const surnames = [
    "王", "李", "张", "刘", "陈", "杨", "赵", "黄", "周", "吴",
    "徐", "孙", "胡", "朱", "高", "林", "何", "郭", "马", "罗",
    "梁", "宋", "郑", "谢", "韩", "唐", "冯", "于", "董", "萧"
];

/**
 * 常用名字列表
 */
export const givenNames = [
    "伟", "芳", "娜", "秀英", "敏", "静", "丽", "强", "磊", "军",
    "洋", "勇", "艳", "杰", "娟", "涛", "明", "超", "秀兰", "霞",
    "平", "刚", "桂英", "建华", "建国", "志强", "志明", "秀珍", "桂兰", "婷"
];

/**
 * 随机生成姓名
 */
export function randomName(): string {
    const surname = surnames[Math.floor(Math.random() * surnames.length)] ?? "张";
    const givenName = givenNames[Math.floor(Math.random() * givenNames.length)] ?? "伟";
    return surname + givenName;
}

/**
 * 随机选择数组中的一个元素
 */
export function randomChoice<T>(arr: readonly T[] | T[]): T {
    const result = arr[Math.floor(Math.random() * arr.length)];
    return result as T;
}

/**
 * 随机生成年龄
 */
export function randomAge(min = 18, max = 80): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * 随机生成日期
 */
export function randomDate(startYear: number, endYear: number): string {
    const year = Math.floor(Math.random() * (endYear - startYear + 1)) + startYear;
    const month = String(Math.floor(Math.random() * 12) + 1).padStart(2, "0");
    const day = String(Math.floor(Math.random() * 28) + 1).padStart(2, "0");
    const hour = String(Math.floor(Math.random() * 24)).padStart(2, "0");
    const minute = String(Math.floor(Math.random() * 60)).padStart(2, "0");
    return `${year}年${month}月${day}日 ${hour}时${minute}分`;
}

/**
 * 湖南省地区
 */
const hunanCities = [
    "长沙市", "株洲市", "湘潭市", "衡阳市", "邵阳市",
    "岳阳市", "常德市", "张家界市", "益阳市", "郴州市",
    "永州市", "怀化市", "娄底市", "湘西土家族苗族自治州"
];

/**
 * 区县列表
 */
const districts = [
    "开福区", "岳麓区", "天心区", "雨花区", "芙蓉区",
    "望城区", "长沙县", "宁乡市", "浏阳市",
    "荷塘区", "芦淞区", "石峰区", "天元区"
];

/**
 * 随机生成地址
 */
export function randomAddress(): string {
    const city = randomChoice(hunanCities);
    const district = randomChoice(districts);
    const street = Math.floor(Math.random() * 200) + 1;
    const number = Math.floor(Math.random() * 500) + 1;
    return `湖南省${city}${district}${street}路${number}号`;
}

/**
 * 职业列表
 */
export const occupations = [
    "工人", "农民", "教师", "医生", "护士", "公务员", "学生",
    "公司职员", "个体户", "退休人员", "司机", "工程师", "会计"
];

/**
 * 科室及疾病模板
 */
export const departmentTemplates: DepartmentTemplate[] = [
    {
        name: "呼吸内科",
        diseases: [
            {
                name: "肺炎",
                mainSymptoms: ["发热", "咳嗽", "咳痰", "胸痛"],
                accompanyingSymptoms: ["气促", "乏力", "食欲减退", "头痛"],
                typicalSigns: ["体温升高", "双肺呼吸音粗", "可闻及干湿性啰音", "心率加快"],
                abnormalExams: ["血常规:白细胞计数升高", "胸片:肺部浸润影", "CRP升高", "血沉加快"],
                diagnosticPoints: ["发热咳嗽咳痰", "肺部体征", "胸片异常", "血常规异常"],
                differentialDiagnoses: ["肺结核", "肺癌", "支气管扩张", "间质性肺病"],
                treatmentPlan: ["抗感染治疗", "止咳化痰", "对症支持", "复查胸片"]
            },
            {
                name: "慢性支气管炎",
                mainSymptoms: ["咳嗽", "咳痰", "气促"],
                accompanyingSymptoms: ["喘息", "胸闷", "发热"],
                typicalSigns: ["双肺呼吸音粗", "可闻及哮鸣音", "桶状胸", "发绀"],
                abnormalExams: ["肺功能:阻塞性通气障碍", "胸片:肺纹理增粗", "血常规"],
                diagnosticPoints: ["慢性咳嗽咳痰", "每年发病3个月以上", "持续2年以上"],
                differentialDiagnoses: ["支气管哮喘", "肺结核", "肺癌", "支气管扩张"],
                treatmentPlan: ["戒烟", "支气管舒张剂", "祛痰药", "氧疗"]
            },
            {
                name: "支气管哮喘",
                mainSymptoms: ["喘息", "气促", "胸闷", "咳嗽"],
                accompanyingSymptoms: ["夜间及凌晨加重", "呼气延长", "可自行缓解"],
                typicalSigns: ["双肺散在哮鸣音", "呼气延长", "心率加快"],
                abnormalExams: ["肺功能:支气管舒张试验阳性", "呼气峰流速变异率增大", "血常规:嗜酸性粒细胞增多"],
                diagnosticPoints: ["反复发作喘息", "呼气性呼吸困难", "肺部哮鸣音", "可自行缓解"],
                differentialDiagnoses: ["慢性阻塞性肺疾病", "心源性哮喘", "支气管肺癌", "肺栓塞"],
                treatmentPlan: ["吸入糖皮质激素", "支气管舒张剂", "避免过敏原", "健康教育"]
            }
        ]
    },
    {
        name: "消化内科",
        diseases: [
            {
                name: "胃炎",
                mainSymptoms: ["上腹痛", "腹胀", "嗳气", "反酸"],
                accompanyingSymptoms: ["恶心", "呕吐", "食欲减退", "烧心"],
                typicalSigns: ["上腹部压痛", "无反跳痛", "肠鸣音正常"],
                abnormalExams: ["胃镜:慢性浅表性胃炎", "HP阳性", "血常规正常或轻度贫血"],
                diagnosticPoints: ["上腹痛腹胀", "胃镜检查", "HP检测"],
                differentialDiagnoses: ["消化性溃疡", "胃癌", "胆囊炎", "胰腺炎"],
                treatmentPlan: ["根除HP治疗", "抑酸护胃", "促胃肠动力", "改善生活习惯"]
            },
            {
                name: "消化道出血",
                mainSymptoms: ["便血", "呕血", "黑便", "头晕"],
                accompanyingSymptoms: ["乏力", "心悸", "出汗", "晕厥"],
                typicalSigns: ["面色苍白", "血压下降", "心率加快", "腹部体征"],
                abnormalExams: ["血常规:血红蛋白下降", "便常规:隐血阳性", "胃镜:可见出血灶"],
                diagnosticPoints: ["便血/呕血", "血红蛋白下降", "胃镜检查"],
                differentialDiagnoses: ["消化性溃疡", "胃癌", "食管胃底静脉曲张", "急性胃粘膜病变"],
                treatmentPlan: ["禁食", "抑酸止血", "补液扩容", "必要时内镜下止血"]
            },
            {
                name: "肝炎",
                mainSymptoms: ["乏力", "纳差", "恶心", "腹胀"],
                accompanyingSymptoms: ["尿黄", "眼黄", "皮肤黄", "右上腹不适"],
                typicalSigns: ["巩膜黄染", "肝脾肿大", "肝区压痛", "蜘蛛痣"],
                abnormalExams: ["肝功能:ALT/AST升高", "HBV阳性", "胆红素升高", "凝血功能异常"],
                diagnosticPoints: ["乏力纳差", "肝功能异常", "肝炎病毒标志物"],
                differentialDiagnoses: ["脂肪肝", "酒精性肝病", "自身免疫性肝炎", "药物性肝损伤"],
                treatmentPlan: ["抗病毒治疗", "保肝降酶", "休息", "定期复查"]
            }
        ]
    },
    {
        name: "心内科",
        diseases: [
            {
                name: "冠心病",
                mainSymptoms: ["胸痛", "胸闷", "气促"],
                accompanyingSymptoms: ["心悸", "出汗", "恶心", "乏力"],
                typicalSigns: ["心率加快", "血压升高或下降", "心律不齐", "心音异常"],
                abnormalExams: ["心电图:ST-T改变", "心肌酶谱升高", "冠脉CTA/造影狭窄"],
                diagnosticPoints: ["胸痛特点", "心电图动态变化", "心肌酶谱", "冠脉影像"],
                differentialDiagnoses: ["心绞痛", "心肌梗死", "心包炎", "肺栓塞"],
                treatmentPlan: ["抗血小板", "调脂稳定斑块", "硝酸酯类", "必要时介入治疗"]
            },
            {
                name: "高血压",
                mainSymptoms: ["头晕", "头痛", "头胀", "乏力"],
                accompanyingSymptoms: ["胸闷", "心悸", "耳鸣", "视力模糊"],
                typicalSigns: ["血压升高", "心率加快", "心界扩大", "眼底改变"],
                abnormalExams: ["血压持续升高", "心电图:左室肥厚", "尿蛋白", "肾功能异常"],
                diagnosticPoints: ["多次血压测量升高", "排除继发性高血压", "靶器官损害"],
                differentialDiagnoses: ["原发性高血压", "肾性高血压", "嗜铬细胞瘤", "原发性醛固酮增多症"],
                treatmentPlan: ["低盐低脂饮食", "降压药物", "监测血压", "定期复查"]
            },
            {
                name: "心律失常",
                mainSymptoms: ["心悸", "胸闷", "头晕", "乏力"],
                accompanyingSymptoms: ["晕厥", "胸痛", "气促", "出汗"],
                typicalSigns: ["心率异常", "心律不齐", "脉搏不规则", "心音异常"],
                abnormalExams: ["心电图:心律失常类型", "动态心电图", "心脏超声", "电解质"],
                diagnosticPoints: ["心悸症状", "心电图异常", "动态心电图"],
                differentialDiagnoses: ["房颤", "室上性心动过速", "室性早搏", "房室传导阻滞"],
                treatmentPlan: ["抗心律失常药物", "必要时射频消融", "定期复查", "避免诱因"]
            }
        ]
    },
    {
        name: "神经内科",
        diseases: [
            {
                name: "脑梗死",
                mainSymptoms: ["偏瘫", "言语不清", "口眼歪斜", "头晕"],
                accompanyingSymptoms: ["意识障碍", "肢体麻木", "饮水呛咳", "视力障碍"],
                typicalSigns: ["偏瘫体征", "病理征阳性", "言语障碍", "面瘫"],
                abnormalExams: ["头颅CT:低密度灶", "MRI:长T1长T2信号", "DWI高信号", "血糖血脂异常"],
                diagnosticPoints: ["急性起病", "局灶性神经功能缺损", "头颅CT/MRI证据"],
                differentialDiagnoses: ["脑出血", "TIA", "脑肿瘤", "代谢性疾病"],
                treatmentPlan: ["溶栓/取栓", "抗血小板", "调脂稳定斑块", "康复锻炼"]
            },
            {
                name: "偏头痛",
                mainSymptoms: ["头痛", "恶心", "呕吐", "畏光"],
                accompanyingSymptoms: ["视觉先兆", "感觉异常", "语言障碍"],
                typicalSigns: ["神经系统体征阴性", "发作时痛苦面容"],
                abnormalExams: ["头颅CT/MRI正常", "TCD:血流速度增快"],
                diagnosticPoints: ["反复发作性头痛", "典型临床特点", "排除其他疾病"],
                differentialDiagnoses: ["紧张性头痛", "丛集性头痛", "脑肿瘤", "脑血管畸形"],
                treatmentPlan: ["急性期止痛", "预防性治疗", "避免诱因", "健康教育"]
            }
        ]
    },
    {
        name: "内分泌科",
        diseases: [
            {
                name: "糖尿病",
                mainSymptoms: ["多饮", "多尿", "多食", "消瘦"],
                accompanyingSymptoms: ["乏力", "口干", "皮肤瘙痒", "视物模糊"],
                typicalSigns: ["体重下降", "血糖升高", "可无明显体征"],
                abnormalExams: ["空腹血糖升高", "餐后2小时血糖升高", "HbA1c升高", "尿糖阳性"],
                diagnosticPoints: ["糖尿病症状", "空腹血糖≥7.0mmol/L", "OGTT试验"],
                differentialDiagnoses: ["1型糖尿病", "2型糖尿病", "继发性糖尿病", "糖耐量异常"],
                treatmentPlan: ["饮食控制", "运动疗法", "口服降糖药", "胰岛素治疗"]
            },
            {
                name: "甲状腺功能亢进",
                mainSymptoms: ["心悸", "怕热", "多汗", "多食消瘦"],
                accompanyingSymptoms: ["手抖", "烦躁", "失眠", "月经减少"],
                typicalSigns: ["甲状腺肿大", "突眼", "心率加快", "双手震颤"],
                abnormalExams: ["FT3/FT4升高", "TSH降低", "甲状腺抗体阳性", "肝功能异常"],
                diagnosticPoints: ["高代谢症状", "甲状腺肿大", "甲功异常"],
                differentialDiagnoses: ["Graves病", "亚急性甲状腺炎", "桥本甲状腺炎", "碘甲亢"],
                treatmentPlan: ["抗甲状腺药物", "放射性碘治疗", "手术治疗", "对症支持"]
            }
        ]
    },
    {
        name: "肾内科",
        diseases: [
            {
                name: "肾炎",
                mainSymptoms: ["血尿", "蛋白尿", "水肿", "高血压"],
                accompanyingSymptoms: ["乏力", "腰痛", "尿量改变", "泡沫尿"],
                typicalSigns: ["水肿", "高血压", "肾区叩击痛"],
                abnormalExams: ["尿常规:蛋白尿/血尿", "肾功能:肌酐升高", "肾脏超声", "肾活检"],
                diagnosticPoints: ["尿检异常", "肾功能损害", "肾脏影像学"],
                differentialDiagnoses: ["急性肾炎", "慢性肾炎", "IgA肾病", "肾病综合征"],
                treatmentPlan: ["利尿消肿", "降压治疗", "激素/免疫抑制剂", "优质低蛋白饮食"]
            },
            {
                name: "尿路感染",
                mainSymptoms: ["尿频", "尿急", "尿痛", "腰痛"],
                accompanyingSymptoms: ["发热", "血尿", "尿浑浊", "下腹不适"],
                typicalSigns: ["肾区叩击痛", "膀胱区压痛", "发热"],
                abnormalExams: ["尿常规:白细胞升高", "尿培养阳性", "血常规:白细胞升高"],
                diagnosticPoints: ["尿路刺激征", "尿常规异常", "尿培养阳性"],
                differentialDiagnoses: ["急性膀胱炎", "急性肾盂肾炎", "泌尿系结石", "结核"],
                treatmentPlan: ["抗感染治疗", "多饮水", "保持会阴清洁", "定期复查"]
            }
        ]
    },
    {
        name: "骨科",
        diseases: [
            {
                name: "骨折",
                mainSymptoms: ["疼痛", "肿胀", "功能障碍", "畸形"],
                accompanyingSymptoms: ["皮下瘀斑", "活动受限", "感觉异常"],
                typicalSigns: ["局部压痛", "骨擦音", "反常活动", "肢体缩短"],
                abnormalExams: ["X线:骨折线", "CT:骨折详情", "MRI:软组织损伤"],
                diagnosticPoints: ["外伤史", "疼痛肿胀", "X线证据"],
                differentialDiagnoses: ["软组织损伤", "脱位", "挫伤", "骨病"],
                treatmentPlan: ["手法复位", "外固定", "内固定", "功能锻炼"]
            },
            {
                name: "腰椎间盘突出",
                mainSymptoms: ["腰痛", "下肢放射痛", "麻木"],
                accompanyingSymptoms: ["间歇性跛行", "大小便障碍", "肌肉无力"],
                typicalSigns: ["腰椎压痛", "直腿抬高试验阳性", "感觉减退", "肌力下降"],
                abnormalExams: ["腰椎MRI:椎间盘突出", "CT:间盘突出", "X线:骨质增生"],
                diagnosticPoints: ["腰痛伴下肢放射痛", "体格检查阳性", "影像学证据"],
                differentialDiagnoses: ["腰肌劳损", "腰椎管狭窄", "腰椎结核", "肿瘤"],
                treatmentPlan: ["卧床休息", "牵引治疗", "药物治疗", "手术治疗"]
            }
        ]
    },
    {
        name: "普外科",
        diseases: [
            {
                name: "急性阑尾炎",
                mainSymptoms: ["腹痛", "恶心", "呕吐", "发热"],
                accompanyingSymptoms: ["食欲减退", "腹胀", "腹泻", "尿黄"],
                typicalSigns: ["右下腹压痛", "反跳痛", "肌紧张", "麦氏点压痛"],
                abnormalExams: ["血常规:白细胞升高", "腹部CT:阑尾增粗", "B超:阑尾肿大"],
                diagnosticPoints: ["转移性右下腹痛", "麦氏点压痛", "血常规异常", "影像学证据"],
                differentialDiagnoses: ["急性胃肠炎", "泌尿系结石", "妇科急症", " Meckel憩室炎"],
                treatmentPlan: ["急诊手术", "抗感染治疗", "补液支持", "术后康复"]
            },
            {
                name: "胆囊结石伴急性胆囊炎",
                mainSymptoms: ["右上腹痛", "恶心", "呕吐", "发热"],
                accompanyingSymptoms: ["黄疸", "腹胀", "食欲减退", "油腻食物诱发"],
                typicalSigns: ["右上腹压痛", "墨菲氏征阳性", "肌紧张", "肝区叩击痛"],
                abnormalExams: ["腹部B超:胆囊结石", "血常规:白细胞升高", "肝功能:胆红素升高", "MRCP:胆管结石"],
                diagnosticPoints: ["右上腹痛", "墨菲氏征阳性", "B超结石证据", "血常规异常"],
                differentialDiagnoses: ["胆管结石", "急性肝炎", "胰腺炎", "胃十二指肠溃疡"],
                treatmentPlan: ["禁食", "抗感染治疗", "腹腔镜胆囊切除术", "对症支持"]
            },
            {
                name: "腹股沟疝",
                mainSymptoms: ["腹股沟区包块", "腹胀", "腹痛"],
                accompanyingSymptoms: ["站立时加重", "平卧可还纳", "消化不良", "便秘"],
                typicalSigns: ["腹股沟区可复性包块", "还纳试验阳性", "咳嗽冲击感", "阴囊肿大"],
                abnormalExams: ["腹部B超:疝囊", "CT:疝内容物", "血常规正常"],
                diagnosticPoints: ["腹股沟区包块", "可还纳", "咳嗽冲击感", "B超证据"],
                differentialDiagnoses: ["股疝", "鞘膜积液", "脂肪瘤", "淋巴结肿大"],
                treatmentPlan: ["择期手术", "疝修补术", "腹腔镜手术", "术后避免重体力"]
            },
            {
                name: "甲状腺腺瘤",
                mainSymptoms: ["颈部包块", "颈部不适", "吞咽不适"],
                accompanyingSymptoms: ["心悸", "多汗", "手抖", "声音嘶哑"],
                typicalSigns: ["甲状腺单发结节", "边界清晰", "随吞咽活动", "颈部淋巴结不大"],
                abnormalExams: ["甲状腺B超:腺瘤", "甲状腺功能正常", "细针穿刺活检", "CT:肿瘤侵犯"],
                diagnosticPoints: ["颈部包块", "B超结节特征", "甲状腺功能", "活检结果"],
                differentialDiagnoses: ["结节性甲状腺肿", "甲状腺癌", "甲状腺炎", "甲状旁腺瘤"],
                treatmentPlan: ["手术治疗", "甲状腺腺叶切除", "定期复查", "甲状腺激素替代"]
            },
            {
                name: "乳腺纤维腺瘤",
                mainSymptoms: ["乳房包块", "乳房胀痛"],
                accompanyingSymptoms: ["与月经周期相关", "乳头溢液", "皮肤改变"],
                typicalSigns: ["乳房单发结节", "边界清晰", "活动度好", "无橘皮样改变"],
                abnormalExams: ["乳腺B超:纤维腺瘤", "钼靶:肿块", "MRI:肿瘤特征", "肿瘤标志物正常"],
                diagnosticPoints: ["乳房结节", "B超特征", "钼靶表现", "年龄因素"],
                differentialDiagnoses: ["乳腺癌", "乳腺囊性增生", "乳腺炎", "叶状肿瘤"],
                treatmentPlan: ["定期观察", "手术切除", "微创手术", "定期随访"]
            }
        ]
    },
    {
        name: "妇产科",
        diseases: [
            {
                name: "子宫肌瘤",
                mainSymptoms: ["月经增多", "经期延长", "下腹包块", "压迫症状"],
                accompanyingSymptoms: ["贫血", "腹痛", "尿频", "便秘"],
                typicalSigns: ["子宫增大", "质硬", "表面不平"],
                abnormalExams: ["B超:子宫肌瘤", "血常规:贫血", "肿瘤标志物"],
                diagnosticPoints: ["月经改变", "下腹包块", "B超证据"],
                differentialDiagnoses: ["子宫腺肌症", "卵巢肿瘤", "妊娠", "子宫肉瘤"],
                treatmentPlan: ["定期复查", "药物治疗", "手术治疗", "介入治疗"]
            },
            {
                name: "异位妊娠",
                mainSymptoms: ["停经", "腹痛", "阴道流血"],
                accompanyingSymptoms: ["晕厥", "休克", "肛门坠胀"],
                typicalSigns: ["宫颈举痛", "子宫增大", "附件包块", "移动性浊音阳性"],
                abnormalExams: ["血HCG升高", "B超:宫内无孕囊", "后穹隆穿刺抽出不凝血"],
                diagnosticPoints: ["停经后腹痛", "血HCG异常", "B超证据"],
                differentialDiagnoses: ["流产", "卵巢囊肿破裂", "急性阑尾炎", "盆腔炎"],
                treatmentPlan: ["药物治疗", "手术治疗", "定期监测", "对症支持"]
            }
        ]
    },
    {
        name: "儿科",
        diseases: [
            {
                name: "支气管肺炎",
                mainSymptoms: ["发热", "咳嗽", "咳痰", "气促"],
                accompanyingSymptoms: ["食欲减退", "烦躁", "嗜睡", "呕吐"],
                typicalSigns: ["呼吸急促", "双肺固定中细湿啰音", "鼻翼煽动", "三凹征"],
                abnormalExams: ["胸片:斑片状阴影", "血常规:白细胞升高", "CRP升高"],
                diagnosticPoints: ["发热咳嗽气促", "肺部体征", "胸片证据"],
                differentialDiagnoses: ["支气管炎", "肺结核", "哮喘", "异物吸入"],
                treatmentPlan: ["抗感染", "止咳化痰", "氧疗", "对症支持"]
            },
            {
                name: "腹泻病",
                mainSymptoms: ["腹泻", "呕吐", "发热", "腹痛"],
                accompanyingSymptoms: ["口渴", "尿量减少", "精神差"],
                typicalSigns: ["脱水体征", "肠鸣音亢进", "大便性状改变"],
                abnormalExams: ["大便常规:白细胞/红细胞", "轮状病毒阳性", "血常规", "电解质"],
                diagnosticPoints: ["大便次数增多", "大便性状改变", "伴随症状"],
                differentialDiagnoses: ["轮状病毒肠炎", "细菌性痢疾", "食物中毒", "乳糖不耐受"],
                treatmentPlan: ["补液治疗", "饮食调整", "益生菌", "锌剂"]
            }
        ]
    },
    {
        name: "泌尿外科",
        diseases: [
            {
                name: "肾结石",
                mainSymptoms: ["腰痛", "腹痛", "血尿", "尿频"],
                accompanyingSymptoms: ["恶心", "呕吐", "发热", "尿急"],
                typicalSigns: ["肾区叩击痛", "输尿管点压痛", "腹部压痛", "面色苍白"],
                abnormalExams: ["泌尿系B超:结石", "腹部CT:结石位置", "尿常规:红细胞", "KUB:阳性结石"],
                diagnosticPoints: ["典型肾绞痛", "血尿", "影像学结石证据", "尿常规异常"],
                differentialDiagnoses: ["急性阑尾炎", "胆囊结石", "胰腺炎", "泌尿系结核"],
                treatmentPlan: ["体外碎石", "腔镜手术", "多饮水", "定期复查"]
            },
            {
                name: "前列腺增生",
                mainSymptoms: ["尿频", "尿急", "尿不尽", "排尿困难"],
                accompanyingSymptoms: ["夜尿增多", "尿等待", "尿线变细", "残余尿"],
                typicalSigns: ["前列腺增大", "质地中等", "中央沟变浅", "膀胱充盈"],
                abnormalExams: ["前列腺B超:增大", "尿流率:下降", "PSA:正常", "残余尿测定"],
                diagnosticPoints: ["排尿症状", "前列腺增大", "尿流率异常", "PSA排除肿瘤"],
                differentialDiagnoses: ["前列腺癌", "尿道狭窄", "神经源性膀胱", "膀胱颈梗阻"],
                treatmentPlan: ["药物治疗", "TURP手术", "定期复查", "生活方式调整"]
            },
            {
                name: "膀胱肿瘤",
                mainSymptoms: ["无痛性血尿", "尿频", "尿急", "尿痛"],
                accompanyingSymptoms: ["排尿困难", "尿潴留", "腰痛", "体重下降"],
                typicalSigns: ["膀胱区压痛", "腹部包块", "血块", "消瘦"],
                abnormalExams: ["膀胱镜:肿瘤", "B超:膀胱占位", "CT:分期", "尿脱落细胞:阳性"],
                diagnosticPoints: ["无痛性血尿", "膀胱镜检", "影像学占位", "细胞学阳性"],
                differentialDiagnoses: ["膀胱炎", "膀胱结石", "前列腺增生", "泌尿系结核"],
                treatmentPlan: ["TURBt手术", "膀胱灌注", "根治性膀胱切除", "定期复查"]
            },
            {
                name: "精索静脉曲张",
                mainSymptoms: ["阴囊坠胀", "阴囊疼痛", "生育障碍", "阴囊肿大"],
                accompanyingSymptoms: ["久站加重", "平卧减轻", "精子异常", "睾丸萎缩"],
                typicalSigns: ["阴囊可见曲张静脉", "蚯蚓状团块", "Valsalva阳性", "睾丸大小异常"],
                abnormalExams: ["阴囊B超:静脉曲张", "精液分析:少弱精子", "多普勒:返流", "睾丸测量:萎缩"],
                diagnosticPoints: ["阴囊坠胀", "体格检查曲张", "B超静脉扩张", "精液异常"],
                differentialDiagnoses: ["鞘膜积液", "腹股沟疝", "睾丸肿瘤", "附睾炎"],
                treatmentPlan: ["保守观察", "显微镜手术", "腹腔镜手术", "定期复查"]
            },
            {
                name: "包皮过长/包茎",
                mainSymptoms: ["包皮过长", "包皮不能上翻", "反复感染", "排尿困难"],
                accompanyingSymptoms: ["包皮垢增多", "包皮瘙痒", "龟头炎", "性功能障碍"],
                typicalSigns: ["包皮口狭窄", "龟头不能外露", "包皮垢堆积", "炎症表现"],
                abnormalExams: ["泌尿外科检查", "尿常规:感染", "分泌物培养", "性传播疾病筛查"],
                diagnosticPoints: ["包皮不能上翻", "包皮口狭窄", "反复感染", "排尿影响"],
                differentialDiagnoses: ["包皮龟头炎", "尖锐湿疣", "阴茎癌", "尿道下裂"],
                treatmentPlan: ["包皮环切术", "保守治疗", "每日清洗", "定期复查"]
            }
        ]
    }
];

/**
 * 根据科室获取随机模板
 */
export function getRandomTemplate(department?: string, disease?: string): {
    department: string;
    disease: {
        name: string;
        mainSymptoms: string[];
        accompanyingSymptoms: string[];
        typicalSigns: string[];
        abnormalExams: string[];
        diagnosticPoints: string[];
        differentialDiagnoses: string[];
        treatmentPlan: string[];
    };
} {
    let deptTemplate: DepartmentTemplate;

    if (department) {
        deptTemplate = departmentTemplates.find(d => d.name === department) || randomChoice(departmentTemplates);
    } else {
        deptTemplate = randomChoice(departmentTemplates);
    }

    let diseaseTemplate = deptTemplate.diseases[0];
    if (disease) {
        diseaseTemplate = deptTemplate.diseases.find(d => d.name === disease) || randomChoice(deptTemplate.diseases);
    } else {
        diseaseTemplate = randomChoice(deptTemplate.diseases);
    }

    return {
        department: deptTemplate.name,
        disease: diseaseTemplate
    };
}
