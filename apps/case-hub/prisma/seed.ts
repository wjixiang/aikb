import { PrismaClient } from '../src/generated/prisma';

const prisma = new PrismaClient();

async function main() {
  console.log('Start seeding case templates...');

  // 内科模板
  const internalMedicineTemplates = [
    {
      name: '高血压初诊模板',
      department: '内科',
      disease: '高血压',
      template: `主诉：反复头晕、头痛{{duration}}，加重{{aggravationDuration}}。

现病史：患者于{{onsetTime}}前无明显诱因出现头晕、头痛，以枕部为著，呈持续性胀痛，伴恶心，无呕吐。当时测血压{{initialBP}}mmHg，未予重视。后上述症状反复发作，多于劳累或情绪激动后加重，休息后可缓解。{{aggravationTime}}前症状加重，伴胸闷、心悸，遂来我院就诊。

既往史：{{pastHistory}}。

个人史：{{personalHistory}}。

家族史：{{familyHistory}}。

体格检查：
T：{{temperature}}℃ P：{{pulse}}次/分 R：{{respiration}}次/分 BP：{{bp}}mmHg
神志清楚，精神可，心肺腹查体未见明显异常。

辅助检查：
- 血常规：{{cbcResult}}
- 生化全套：{{biochemistryResult}}
- 心电图：{{ecgResult}}
- 心脏彩超：{{echocardiogramResult}}

初步诊断：
1. 高血压病{{grade}}级 {{riskLevel}}

诊疗计划：
1. 完善相关检查
2. 降压治疗：{{medication}}
3. 低盐低脂饮食，适当运动
4. 监测血压变化`,
      description: '适用于高血压初诊患者的病历模板',
    },
    {
      name: '糖尿病随访模板',
      department: '内科',
      disease: '糖尿病',
      template: `主诉：确诊糖尿病{{diabetesDuration}}，{{followupReason}}。

现病史：患者于{{diagnosisTime}}前确诊为2型糖尿病，长期{{treatment}}治疗。近期血糖控制{{controlStatus}}，{{symptoms}}。

既往史：{{pastHistory}}。

体格检查：
T：{{temperature}}℃ P：{{pulse}}次/分 R：{{respiration}}次/分 BP：{{bp}}mmHg
身高：{{height}}cm 体重：{{weight}}kg BMI：{{bmi}}kg/m²
神志清楚，心肺腹查体未见明显异常。双下肢感觉{{sensation}}，足背动脉搏动{{pulseStatus}}。

辅助检查：
- 空腹血糖：{{fpg}}mmol/L
- 餐后2小时血糖：{{ppg}}mmol/L
- 糖化血红蛋白：{{hba1c}}%
- 肾功能：{{renalFunction}}
- 血脂：{{lipidProfile}}
- 尿微量白蛋白：{{microalbumin}}

诊断：
1. 2型糖尿病 {{complications}}

诊疗计划：
1. 继续{{medication}}治疗
2. 血糖监测方案：{{monitoringPlan}}
3. 饮食运动指导
4. {{followupPlan}}后复查`,
      description: '适用于糖尿病患者的随访病历模板',
    },
    {
      name: '冠心病模板',
      department: '内科',
      disease: '冠心病',
      template: `主诉：胸闷、胸痛{{duration}}。

现病史：患者于{{onsetTime}}前出现胸闷、胸痛，位于胸骨后/心前区，呈压榨性/紧缩性，持续约{{duration}}分钟，{{trigger}}诱发，{{relief}}缓解。伴{{associatedSymptoms}}。

既往史：{{pastHistory}}。

危险因素：{{riskFactors}}。

体格检查：
T：{{temperature}}℃ P：{{pulse}}次/分 R：{{respiration}}次/分 BP：{{bp}}mmHg
神志清楚，颈静脉{{jugularVein}}，双肺呼吸音{{lungSound}}，心率{{heartRate}}次/分，心律{{rhythm}}，心音{{heartSound}}，各瓣膜区{{murmur}}杂音，双下肢{{edema}}水肿。

辅助检查：
- 心肌酶谱：{{cardiacEnzymes}}
- 肌钙蛋白：{{troponin}}
- 心电图：{{ecg}}
- 心脏彩超：{{echocardiogram}}
- 冠脉CTA/造影：{{coronaryAngiography}}

诊断：
1. 冠状动脉粥样硬化性心脏病
   {{specificDiagnosis}}
   {{nyhaClass}}

诊疗计划：
1. {{medication}}
2. {{intervention}}
3. 低脂饮食，戒烟限酒
4. 定期复查`,
      description: '适用于冠心病患者的病历模板',
    },
  ];

  // 外科模板
  const surgeryTemplates = [
    {
      name: '阑尾炎手术模板',
      department: '外科',
      disease: '急性阑尾炎',
      template: `主诉：转移性右下腹痛{{duration}}。

现病史：患者于{{onsetTime}}前出现上腹部/脐周疼痛，呈持续性隐痛，伴{{associatedSymptoms}}。{{migrationTime}}后疼痛转移并固定于右下腹，呈持续性加重，伴{{otherSymptoms}}。

既往史：{{pastHistory}}。

体格检查：
T：{{temperature}}℃ P：{{pulse}}次/分 R：{{respiration}}次/分 BP：{{bp}}mmHg
急性病容，神志清楚。心肺查体未见明显异常。腹平坦，未见胃肠型及蠕动波，右下腹压痛、反跳痛（{{reboundTenderness}}），肌紧张（{{muscleGuarding}}），麦氏点压痛明显，肠鸣音{{bowelSounds}}。

辅助检查：
- 血常规：WBC {{wbc}}×10⁹/L，N {{neutrophil}}%
- 腹部彩超/CT：{{imagingResult}}
- 尿常规：{{urinalysis}}

诊断：
1. 急性{{severity}}阑尾炎

手术记录：
手术名称：{{operationName}}
麻醉方式：{{anesthesia}}
手术时间：{{operationTime}}
术中所见：{{operativeFindings}}
手术过程：{{operativeProcedure}}
术中出血：{{bloodLoss}}ml
术后处理：{{postoperativeCare}}

术后医嘱：
1. {{postopMedication}}
2. 切口换药
3. 根据病理结果决定后续治疗`,
      description: '适用于急性阑尾炎手术患者的病历模板',
    },
    {
      name: '胆囊切除术模板',
      department: '外科',
      disease: '胆囊结石',
      template: `主诉：右上腹疼痛{{duration}}。

现病史：患者于{{onsetTime}}前进食{{triggerFood}}后出现右上腹疼痛，呈阵发性绞痛/持续性胀痛，向右肩背部放射，伴{{associatedSymptoms}}。

既往史：{{pastHistory}}。

体格检查：
T：{{temperature}}℃ P：{{pulse}}次/分 R：{{respiration}}次/分 BP：{{bp}}mmHg
神志清楚，皮肤巩膜{{jaundice}}黄染。心肺查体未见明显异常。腹软，右上腹压痛（{{tenderness}}），Murphy征（{{murphySign}}），未触及明显包块，肝脾肋下{{organomegaly}}，移动性浊音（{{shiftingDullness}}），肠鸣音{{bowelSounds}}。

辅助检查：
- 血常规：{{cbc}}
- 肝功能：{{liverFunction}}
- 腹部彩超：{{ultrasoundResult}}
- MRCP/CT：{{mrcpResult}}

诊断：
1. 胆囊结石{{withCholecystitis}}
{{commonBileDuctStone}}

手术记录：
手术名称：{{operationName}}
麻醉方式：{{anesthesia}}
手术时间：{{operationTime}}
术中所见：{{operativeFindings}}
手术过程：{{operativeProcedure}}
术中出血：{{bloodLoss}}ml
术后处理：{{postoperativeCare}}

术后医嘱：
1. {{postopMedication}}
2. 低脂饮食
3. 定期复查肝功能、腹部彩超`,
      description: '适用于胆囊结石手术患者的病历模板',
    },
  ];

  // 儿科模板
  const pediatricsTemplates = [
    {
      name: '小儿肺炎模板',
      department: '儿科',
      disease: '肺炎',
      template: `主诉：发热、咳嗽{{duration}}。

现病史：患儿于{{onsetTime}}前出现发热，体温最高{{maxTemp}}℃，{{feverPattern}}，伴咳嗽，初为干咳，后有痰，痰色{{sputumColor}}，伴{{respiratorySymptoms}}。{{otherSymptoms}}。

既往史：{{pastHistory}}。

个人史：足月顺产/剖宫产，出生体重{{birthWeight}}kg，生长发育{{growth}}。

预防接种史：{{vaccinationHistory}}。

家族史：{{familyHistory}}。

体格检查：
T：{{temperature}}℃ P：{{pulse}}次/分 R：{{respiration}}次/分 BP：{{bp}}mmHg SpO₂：{{spo2}}%
神志清楚，精神{{mentalStatus}}，呼吸{{respiratoryPattern}}，口唇{{lipColor}}，咽{{pharynx}}充血，扁桃体{{tonsils}}。
双肺呼吸音{{breathSounds}}，{{rales}}。
心率{{heartRate}}次/分，心律齐，心音有力。
腹部查体未见明显异常。

辅助检查：
- 血常规：WBC {{wbc}}×10⁹/L，N {{neutrophil}}%，L {{lymphocyte}}%
- CRP：{{crp}}mg/L
- PCT：{{pct}}ng/ml
- 胸片/CT：{{chestXray}}
- 病原学检查：{{pathogenTest}}

诊断：
1. {{lobe}}肺炎（{{pathogen}}）

诊疗计划：
1. {{antibiotic}}抗感染治疗
2. 止咳化痰：{{coughMedicine}}
3. 退热对症处理
4. 雾化吸入治疗
5. 密切观察病情变化`,
      description: '适用于小儿肺炎患者的病历模板',
    },
  ];

  // 妇产科模板
  const gynecologyTemplates = [
    {
      name: '正常分娩模板',
      department: '妇产科',
      disease: '正常分娩',
      template: `主诉：停经{{gestationalAge}}周，腹痛{{duration}}。

现病史：孕妇平素月经规律，末次月经{{lmp}}，预产期{{edd}}。孕期产检{{prenatalCare}}，唐筛/无创DNA{{screeningResult}}，大排畸{{anomalyScan}}，OGTT{{ogttResult}}。
{{laborOnset}}出现规律宫缩，间隔{{contractionInterval}}分钟，持续{{contractionDuration}}秒，伴{{otherSymptoms}}。

既往史：{{pastHistory}}。

月经婚育史：初潮{{menarcheAge}}岁，周期{{cycle}}天，经期{{period}}天，经量{{flow}}，无痛经/有痛经。{{marriageHistory}}。{{obstetricHistory}}。

体格检查：
T：{{temperature}}℃ P：{{pulse}}次/分 R：{{respiration}}次/分 BP：{{bp}}mmHg
神志清楚，心肺查体未见明显异常。腹部膨隆，宫高{{fundalHeight}}cm，腹围{{abdominalCircumference}}cm，胎位{{fetalPosition}}，胎心{{fhr}}次/分。

产科检查：
骨盆外测量：髂棘间径{{is}}cm，髂嵴间径{{ic}}cm，骶耻外径{{ec}}cm，坐骨结节间径{{it}}cm。
阴道检查：宫颈管{{cervicalEffacement}}，宫口开大{{cervicalDilation}}cm，先露{{presentation}}，S{{station}}，胎膜{{membranes}}。

分娩记录：
分娩方式：{{deliveryMode}}
分娩时间：{{deliveryTime}}
新生儿：{{newbornGender}}，体重{{birthWeight}}g，Apgar评分：1分钟{{apgar1}}分，5分钟{{apgar5}}分。
胎盘娩出：{{placentaDelivery}}，完整/不完整，出血量{{bloodLoss}}ml。

产后医嘱：
1. 产后护理常规
2. 促宫缩治疗
3. 母乳喂养指导
4. 产后42天复查`,
      description: '适用于正常分娩的病历模板',
    },
  ];

  // 急诊科模板
  const emergencyTemplates = [
    {
      name: '急性腹痛模板',
      department: '急诊科',
      disease: '急性腹痛',
      template: `主诉：腹痛{{duration}}。

现病史：患者于{{onsetTime}}前{{trigger}}出现{{location}}疼痛，呈{{character}}，{{radiation}}，伴{{associatedSymptoms}}。{{reliefFactors}}。

既往史：{{pastHistory}}。

体格检查：
T：{{temperature}}℃ P：{{pulse}}次/分 R：{{respiration}}次/分 BP：{{bp}}mmHg
神志{{consciousness}}，急性病容，{{position}}体位。
心肺查体：{{cardiopulmonaryExam}}。
腹部：{{abdominalExam}}
- 视诊：{{inspection}}
- 触诊：{{palpation}}
- 叩诊：{{percussion}}
- 听诊：{{auscultation}}

辅助检查：
- 血常规：{{cbc}}
- 生化：{{chemistry}}
- 淀粉酶：{{amylase}}
- 尿常规：{{urinalysis}}
- 腹部立位片：{{abdominalXray}}
- 腹部彩超/CT：{{abdominalImaging}}
- 心电图：{{ecg}}

初步诊断：
1. {{diagnosis}}

处理：
1. {{treatment}}
2. {{painManagement}}
3. {{furtherWorkup}}
4. {{disposition}}`,
      description: '适用于急性腹痛患者的急诊病历模板',
    },
  ];

  // 合并所有模板
  const allTemplates = [
    ...internalMedicineTemplates,
    ...surgeryTemplates,
    ...pediatricsTemplates,
    ...gynecologyTemplates,
    ...emergencyTemplates,
  ];

  // 插入模板数据
  for (const template of allTemplates) {
    const existing = await prisma.caseTemplate.findFirst({
      where: { name: template.name },
    });

    if (!existing) {
      await prisma.caseTemplate.create({
        data: template,
      });
      console.log(`Created template: ${template.name}`);
    } else {
      console.log(`Template already exists: ${template.name}`);
    }
  }

  console.log('Seeding completed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
