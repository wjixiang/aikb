import { PromptTemplate } from "@langchain/core/prompts";

export const EMPTY_INDEX_ERROR_MESSAGE =
  "Copilot index does not exist. Please index your vault first!\n\n1. Set a working embedding model in QA settings. If it's not a local model, don't forget to set the API key. \n\n2. Click 'Refresh Index for Vault' and wait for indexing to complete. If you encounter the rate limiting error, please turn your request per second down in QA setting.";

export const AI_SENDER = "ai";
export const USER_SENDER = "user";
export const DEFAULT_SYSTEM_PROMPT = `You are clinic education Copilot, a helpful assistant that integrates AI to note-taking.
  1. Never mention that you do not have access to something. Always rely on the user provided context.
  2. Always answer to the best of your knowledge. If you are unsure about something, say so and ask the user to provide more context.
  3. If the user mentions "note", it most likely means an Obsidian note in the vault, not the generic meaning of a note.
  4. If the user mentions "@vault", it means the user wants you to search the Obsidian vault for information relevant to the query. The search results will be provided to you in the context. If there's no relevant information in the vault, just say so.
  5. If the user mentions any other tool with the @ symbol, check the context for their results. If nothing is found, just ignore the @ symbol in the query.
  6. Always use $'s instead of \\[ etc. for LaTeX equations.
  7. When showing note titles, use [[title]] format and do not wrap them in \` \`.
  8. When showing **Obsidian internal** image links, use ![[link]] format and do not wrap them in \` \`.
  9. When showing **web** image links, use ![link](url) format and do not wrap them in \` \`.
  10. Always respond in the language of the user's query.
  11. Do NOT mention the additional context provided such as getCurrentTime and getTimeRangeMs if it's irrelevant to the user message.`;
export const CHUNK_SIZE = 6000;
export const CONTEXT_SCORE_THRESHOLD = 0.4;
export const TEXT_WEIGHT = 0.4;
export const PLUS_MODE_DEFAULT_SOURCE_CHUNKS = 15;
export const MAX_CHARS_FOR_LOCAL_SEARCH_CONTEXT = 448000;

export enum ABORT_REASON {
  USER_STOPPED = "user-stopped",
  NEW_CHAT = "new-chat",
}

export const entity_types = [
  "disease",
  "pathogenesis",
  "radiology_examination",
  "laboratory_examination",
  "indicator",
  "pathology_change",
  "medicine",
  "surgery",
  "pathogen",
  "pathophysiology",
  "treatment",
  "diagnosis",
  "prognosis",
  "prevention",
  "risk_factor",
  "complication",
  "body_sign",
  "symptom",
  "differential_diagnosis",
  "epidemiology",
  "etiology",
  "anatomy",
  "physiology",
  "chemical",
  "biological_process",
  "gene",
  "hormone",
  "cell",
  "tissue",
  "organ",
  "system",
  "body_part",
  "biomarker",
  "gene",
  "protein",
  "metabolite",
  "pathway",
  "cell_line",
  "animal_model",
  "clinical_trial",
  "drug_class",
  "drug_interaction",
  "adverse_event",
  "clinical_significance",
];
export const relation_types = [
  "causes",
  "treats",
  "diagnoses",
  "prevents",
  "has_symptom",
  "has_sign",
  "has_risk_factor",
  "has_complication",
  "has_pathogenesis",
  "has_pathophysiology",
  "has_prognosis",
  "has_epidemiology",
  "has_etiology",
  "has_anatomy",
  "has_physiology",
  "has_biochemistry",
  "has_molecular_biology",
  "has_genetics",
  "has_immunology",
  "has_microbiology",
  "has_pharmacology",
  "has_toxicology",
];

// Original string template for reference:
// export const ENTITY_EXTRACTION_PROMPT = `Given a text document that is potentially relevant to this activity and a list of entity types, identify all entities of those types from the text and all relationships among the identified entities.
// Use {language} as output language.
//
// ---Steps---
// 1. Identify all entities. For each identified entity, extract the following information:
// - entity_name: Name of the entity, use same language as input text. If English, capitalized the name.
// - entity_type: One of the following types: [{entity_types}]
// - entity_description: Comprehensive description of the entity's attributes and activities
// Format each entity as ("entity"{tuple_delimiter}<entity_name>{tuple_delimiter}<entity_type>{tuple_delimiter}<entity_description>)
//
// 2. From the entities identified in step 1, identify all pairs of (source_entity, target_entity) that are *clearly related* to each other.
// For each pair of related entities, extract the following information:
// - source_entity: name of the source entity, as identified in step 1
// - target_entity: name of the target entity, as identified in step 1
// - relationship_description: explanation as to why you think the source entity and the target entity are related to each other
// - relationship_strength: a numeric score indicating strength of the relationship between the source entity and target entity
// - relationship_keywords: one or more high-level key words that summarize the overarching nature of the relationship, focusing on concepts or themes rather than specific details
// Format each relationship as ("relationship"{tuple_delimiter}<source_entity>{tuple_delimiter}<target_entity>{tuple_delimiter}<relationship_description>{tuple_delimiter}<relationship_keywords>{tuple_delimiter}<relationship_strength>)
//
// 3. Identify high-level key words that summarize the main concepts, themes, or topics of the entire text. These should capture the overarching ideas present in the document.
// Format the content-level key words as ("content_keywords"{tuple_delimiter}<high_level_keywords>)
//
// 4. Return output in {language} as a single list of all the entities and relationships identified in steps 1 and 2. Use **{record_delimiter}** as the list delimiter.
//
// 5. When finished, output {completion_delimiter}
//
// ######################
// ---Examples---
// ######################
// {examples}
//
// #############################
// ---Real Data---
// ######################
// Entity_types: [{entity_types}]
// Text:
// {input_text}
// ######################
// Output:`;

export const ENTITY_EXTRACTION_PROMPT: Record<string, PromptTemplate> = {
  DEFAULT: new PromptTemplate({
    template: `Given a text document that is potentially relevant to this activity and a list of entity types, identify all entities of those types from the text and all relationships among the identified entities.
  Use {language} as output language.
  
  ---Steps---
  1. Identify all entities. For each identified entity, extract the following information:
  - entity_name: Name of the entity, use same language as input text. If English, capitalized the name.
  - entity_type: One of the following types: [{entity_types}]
  - entity_description: Comprehensive description of the entity's attributes and activities
  Format each entity as ("entity"{tuple_delimiter}<entity_name>{tuple_delimiter}<entity_type>{tuple_delimiter}<entity_description>)
  
  2. From the entities identified in step 1, identify all pairs of (source_entity, target_entity) that are *clearly related* to each other.
  For each pair of related entities, extract the following information:
  - source_entity: name of the source entity, as identified in step 1
  - target_entity: name of the target entity, as identified in step 1
  - relationship_description: explanation as to why you think the source entity and the target entity are related to each other
  - relationship_strength: a numeric score indicating strength of the relationship between the source entity and target entity
  - relationship_keywords: one or more high-level key words that summarize the overarching nature of the relationship, focusing on concepts or themes rather than specific details
  Format each relationship as ("relationship"{tuple_delimiter}<source_entity>{tuple_delimiter}<target_entity>{tuple_delimiter}<relationship_description>{tuple_delimiter}<relationship_keywords>{tuple_delimiter}<relationship_strength>)
  
  3. Identify high-level key words that summarize the main concepts, themes, or topics of the entire text. These should capture the overarching ideas present in the document.
  Format the content-level key words as ("content_keywords"{tuple_delimiter}<high_level_keywords>)
  
  4. Return output in {language} as a single list of all the entities and relationships identified in steps 1 and 2. Use **{record_delimiter}** as the list delimiter.
  
  5. When finished, output {completion_delimiter}
  
  ######################
  ---Examples---
  ######################
  {examples}
  
  #############################
  ---Real Data---
  ######################
  Entity_types: [{entity_types}]
  Text:
  {input_text}
  ######################
  Output:`,
    inputVariables: [
      "language",
      "entity_types",
      "tuple_delimiter",
      "record_delimiter",
      "completion_delimiter",
      "examples",
      "input_text",
    ],
  }),
};

export const ENTITY_EXTRACTION_EXAMPLE: Record<string, PromptTemplate> = {
  EXTRACT_DEFINITION: new PromptTemplate({
    template: `EXTRACT_DEFINITION:
  
  Entity_types: [disease, symptom , body_sign]
  Text:
  \`\`\`
  性阻塞性肺疾病（chronic obstructive pulmonary disease，COPD）简称慢阻肺病，是一种异质性的肺部疾病，以因气道异常（支气管炎、细支气管炎）和 / 或肺泡异常（肺气肿）进而引起慢性呼吸症状（呼吸困难、咳嗽、咳痰）及持续的、进行性加重的气流受限为特征。不可逆气流受限是诊断慢阻肺病的关键，在吸入支气管扩张剂后，第一秒用力呼气容积（FEV 1）与用力肺活量（FVC）的比值（FEV 1 / FVC）＜70% 表明存在持续气流受限。
  \`\`\`
  
  Output:
  ("entity"{tuple_delimiter}"慢性阻塞性肺疾病"{tuple_delimiter}"disease"{tuple_delimiter}"慢性阻塞性肺疾病(COPD)是一种异质性的肺部疾病，以气道异常和肺泡异常引起慢性呼吸症状及持续气流受限为特征。"){record_delimiter}
  ("entity"{tuple_delimiter}"慢阻肺病"{tuple_delimiter}"disease"{tuple_delimiter}"慢性阻塞性肺疾病的简称，特征为慢性呼吸症状和持续气流受限。"){record_delimiter}
  ("entity"{tuple_delimiter}"支气管炎"{tuple_delimiter}"disease"{tuple_delimiter}"气道异常表现之一，可导致慢性呼吸症状。"){record_delimiter}
  ("entity"{tuple_delimiter}"细支气管炎"{tuple_delimiter}"disease"{tuple_delimiter}"气道异常表现之一，可导致慢性呼吸症状。"){record_delimiter}
  ("entity"{tuple_delimiter}"肺气肿"{tuple_delimiter}"disease"{tuple_delimiter}"肺泡异常表现之一，可导致慢性呼吸症状。"){record_delimiter}
  ("entity"{tuple_delimiter}"呼吸困难"{tuple_delimiter}"symptom"{tuple_delimiter}"慢性阻塞性肺疾病的主要症状之一，由气道和肺泡异常引起。"){record_delimiter}
  ("entity"{tuple_delimiter}"咳嗽"{tuple_delimiter}"symptom"{tuple_delimiter}"慢性阻塞性肺疾病的主要症状之一，由气道和肺泡异常引起。"){record_delimiter}
  ("entity"{tuple_delimiter}"咳痰"{tuple_delimiter}"symptom"{tuple_delimiter}"慢性阻塞性肺疾病的主要症状之一，由气道和肺泡异常引起。"){record_delimiter}
  ("entity"{tuple_delimiter}"气流受限"{tuple_delimiter}"sign"{tuple_delimiter}"慢性阻塞性肺疾病的关键特征，表现为FEV1/FVC比值＜70%。"){record_delimiter}
  ("relationship"{tuple_delimiter}"慢性阻塞性肺疾病"{tuple_delimiter}"呼吸困难"{tuple_delimiter}"慢性阻塞性肺疾病导致气道和肺泡异常，引起呼吸困难症状。"{tuple_delimiter}"机制"{tuple_delimiter}9){record_delimiter}
  ("relationship"{tuple_delimiter}"慢性阻塞性肺疾病"{tuple_delimiter}"咳嗽"{tuple_delimiter}"慢性阻塞性肺疾病导致气道和肺泡异常，引起咳嗽症状。"{tuple_delimiter}"机制"{tuple_delimiter}8){record_delimiter}
  ("relationship"{tuple_delimiter}"慢性阻塞性肺疾病"{tuple_delimiter}"咳痰"{tuple_delimiter}"慢性阻塞性肺疾病导致气道和肺泡异常，引起咳痰症状。"{tuple_delimiter}"机制"{tuple_delimiter}8){record_delimiter}
  ("relationship"{tuple_delimiter}"慢性阻塞性肺疾病"{tuple_delimiter}"气流受限"{tuple_delimiter}"慢性阻塞性肺疾病导致持续气流受限，表现为FEV1/FVC比值＜70%。"{tuple_delimiter}"诊断标准"{tuple_delimiter}9){record_delimiter}
  ("relationship"{tuple_delimiter}"支气管炎"{tuple_delimiter}"慢性阻塞性肺疾病"{tuple_delimiter}"支气管炎是慢性阻塞性肺疾病的气道异常表现之一。"{tuple_delimiter}"组成"{tuple_delimiter}8){record_delimiter}
  ("relationship"{tuple_delimiter}"细支气管炎"{tuple_delimiter}"慢性阻塞性肺疾病"{tuple_delimiter}"细支气管炎是慢性阻塞性肺疾病的气道异常表现之一。"{tuple_delimiter}"组成"{tuple_delimiter}8){record_delimiter}
  ("relationship"{tuple_delimiter}"肺气肿"{tuple_delimiter}"慢性阻塞性肺疾病"{tuple_delimiter}"肺气肿是慢性阻塞性肺疾病的肺泡异常表现之一。"{tuple_delimiter}"组分"{tuple_delimiter}8){record_delimiter}
  ("content_keywords"{tuple_delimiter}"慢性阻塞性肺疾病, COPD, 气流受限, 呼吸困难, 支气管炎, 肺气肿"){completion_delimiter}
  #############################`,
    inputVariables: [
      "tuple_delimiter",
      "completion_delimiter",
      "record_delimiter",
    ],
  }),
  EXTRACT_CLINICAL_PRESENTATION: new PromptTemplate({
    template: `EXTRACT_CLINICAL_PRESENTATION:
  
  Entity_types: [symptom, body_sign, disease]
  Text:
  \`\`\`
  左心衰竭以肺循环淤血及心排血量降低为主要表现。 1. 症状 （1）不同程度的呼吸困难：①劳力性呼吸困难：是左心衰竭最早出现的症状。因运动使回心血量增加，左心房压力升高，肺淤血加重。随心衰程度的加重，病人活动耐量进行性减退。②夜间阵发性呼吸困难：病人入睡后突然因憋气而惊醒，被迫取坐位，多于端坐休息后缓解。其发生机制除睡眠平卧时血液重新分配使肺血量增加外，夜间迷走神经张力增加、小支气管收缩、横膈抬高、肺活量减少等也是促发因素。③端坐呼吸：肺淤血达到一定程度时，病人不能平卧，因平卧时回心血量增多且横膈上抬，呼吸更为困难。高枕卧位、半卧位甚至端坐时方可好转。④急性肺水肿：是左心衰竭呼吸困难最严重的形式，可有哮鸣音，称为"心源性哮喘"。 （2）咳嗽、咳痰、咯血：咳嗽、咳痰是肺泡和支气管黏膜淤血所致，开始常于夜间发生，坐位或立位时可减轻，白色浆液性泡沫状痰为其特点，偶可见痰中带血丝。急性左心衰竭发作时可出现粉红色泡沫样痰。长期慢性肺淤血肺静脉压力升高，肺循环和支气管血液循环之间在支气管黏膜下形成侧支， 一旦破裂可引起大咯血。 （3） 乏力、疲倦、头晕、心悸：是器官、组织灌注不足及代偿性心率加快所致的症状。 （4） 少尿及肾功能损害症状：严重的左心衰竭血液再分配时，肾血流量首先减少，可出现少尿。长期慢性的肾血流量减少、肾静脉压力升高可出现肾功能不全的相应症状。 2. 体征 （1）肺部湿啰音：由于肺毛细血管楔压增高，液体渗出到肺泡而出现湿啰音。随着病情的加重， 肺部啰音可从局限于肺底部直至全肺。侧卧位时下垂的一侧啰音较多。 （2）心脏体征：除基础心脏病的固有体征外，可有心脏扩大、心率增快及相对性二尖瓣关闭不全的反流性杂音、肺动脉瓣区第二心音亢进、第三心音或第四心音奔马律。 （3）发绀：主要由于呼吸膜水肿、增厚，氧气交换障碍，氧分压下降，还原血红蛋白增加引起，属中央型发绀。
  \`\`\`
  
  Output:
  ("entity"{tuple_delimiter}"左心衰竭"{tuple_delimiter}"disease"{tuple_delimiter}"左心衰竭是一种心血管疾病，以肺循环淤血及心排血量降低为主要表现。"){record_delimiter}
  ("entity"{tuple_delimiter}"呼吸困难"{tuple_delimiter}"symptom"{tuple_delimiter}"呼吸困难是一种症状，在左心衰中严重程度不同。"){record_delimiter}
  ("entity"{tuple_delimiter}"劳力性呼吸困难"{tuple_delimiter}"symptom"{tuple_delimiter}"劳力性呼吸困难是一种呼吸困难，是左心衰竭最早出现的症状。因运动使回心血量增加，左心房压力升高，肺淤血加重。随心衰程度的加重，病人活动耐量进行性减退。"){record_delimiter}
  ("entity"{tuple_delimiter}"夜间阵发性呼吸困难"{tuple_delimiter}"symptom"{tuple_delimiter}"夜间阵发性呼吸困难是一种呼吸困难，病人入睡后突然因憋气而惊醒，被迫取坐位，多于端坐休息后缓解。其发生机制除睡眠平卧时血液重新分配使肺血量增加外，夜间迷走神经张力增加、小支气管收缩、横膈抬高、肺活量减少等也是促发因素。"){record_delimiter}
  ("entity"{tuple_delimiter}"端坐呼吸"{tuple_delimiter}"symptom"{tuple_delimiter}"肺淤血达到一定程度时，病人不能平卧，因平卧时回心血量增多且横膈上抬，呼吸更为困难。高枕卧位、半卧位甚至端坐时方可好转。"){record_delimiter}
  ("entity"{tuple_delimiter}"急性肺水肿"{tuple_delimiter}"symptom"{tuple_delimiter}"急性肺水肿是左心衰竭呼吸困难最严重的形式，可有哮鸣音，称为"心源性哮喘"){record_delimiter}
  ("entity"{tuple_delimiter}"少尿"{tuple_delimiter}"symptom"{tuple_delimiter}"严重的左心衰竭血液再分配时，肾血流量首先减少，可出现少尿。"){record_delimiter}
  ("entity"{tuple_delimiter}"肾功能损害"{tuple_delimiter}"symptom"{tuple_delimiter}"长期慢性的肾血流量减少、肾静脉压力升高可出现肾功能不全的相应症状。"){record_delimiter}
  ("entity"{tuple_delimiter}"肺部湿啰音"{tuple_delimiter}"physical_sign"{tuple_delimiter}"由于肺毛细血管楔压增高，液体渗出到肺泡而出现湿啰音。随着病情的加重，肺部啰音可从局限于肺底部直至全肺。"){record_delimiter}
  ("entity"{tuple_delimiter}"心脏扩大"{tuple_delimiter}"physical_sign"{tuple_delimiter}"除基础心脏病的固有体征外，可有心脏扩大。"){record_delimiter}
  ("entity"{tuple_delimiter}"心率增快"{tuple_delimiter}"physical_sign"{tuple_delimiter}"除基础心脏病的固有体征外，可有心率增快。"){record_delimiter}
  ("entity"{tuple_delimiter}"二尖瓣关闭不全的反流性杂音"{tuple_delimiter}"physical_sign"{tuple_delimiter}"除基础心脏病的固有体征外，可有相对性二尖瓣关闭不全的反流性杂音。"){record_delimiter}
  ("entity"{tuple_delimiter}"肺动脉瓣区第二心音亢进"{tuple_delimiter}"physical_sign"{tuple_delimiter}"除基础心脏病的固有体征外，可有肺动脉瓣区第二心音亢进。"){record_delimiter}
  ("entity"{tuple_delimiter}"第三心音或第四心音奔马律"{tuple_delimiter}"physical_sign"{tuple_delimiter}"除基础心脏病的固有体征外，可有第三心音或第四心音奔马律。"){record_delimiter}
  ("entity"{tuple_delimiter}"发绀"{tuple_delimiter}"physical_sign"{tuple_delimiter}"主要由于呼吸膜水肿、增厚，氧气交换障碍，氧分压下降，还原血红蛋白增加引起，属中央型发绀。"){record_delimiter}
  ("relationship"{tuple_delimiter}"左心衰竭"{tuple_delimiter}"呼吸困难"{tuple_delimiter}"左心衰竭导致肺循环淤血，引起不同程度的呼吸困难症状。"{tuple_delimiter}"has_symptom"{tuple_delimiter}9){record_delimiter}
  ("relationship"{tuple_delimiter}"左心衰竭"{tuple_delimiter}"咳嗽"{tuple_delimiter}"左心衰竭导致肺泡和支气管黏膜淤血，引起咳嗽症状。"{tuple_delimiter}"has_symptom"{tuple_delimiter}8){record_delimiter}
  ("relationship"{tuple_delimiter}"左心衰竭"{tuple_delimiter}"肺部湿啰音"{tuple_delimiter}"左心衰竭导致肺毛细血管楔压增高，液体渗出到肺泡而出现湿啰音。"{tuple_delimiter}"has_sign"{tuple_delimiter}8){record_delimiter}
  ("relationship"{tuple_delimiter}"呼吸困难"{tuple_delimiter}"端坐呼吸"{tuple_delimiter}"呼吸困难严重时表现为端坐呼吸，因平卧时回心血量增多且横膈上抬，呼吸更为困难。"{tuple_delimiter}"progresses_to"{tuple_delimiter}7){record_delimiter}
  ("relationship"{tuple_delimiter}"咳嗽"{tuple_delimiter}"咳痰"{tuple_delimiter}"咳嗽伴随咳痰，白色浆液性泡沫状痰为其特点，由肺泡和支气管黏膜淤血所致。"{tuple_delimiter}"cooccurs_with"{tuple_delimiter}8){record_delimiter}
  ("relationship"{tuple_delimiter}"咳痰"{tuple_delimiter}"咯血"{tuple_delimiter}"长期慢性肺淤血可导致肺静脉压力升高，形成侧支循环，一旦破裂可引起大咯血。"{tuple_delimiter}"progresses_to"{tuple_delimiter}7){record_delimiter}
  ("relationship"{tuple_delimiter}"左心衰竭"{tuple_delimiter}"少尿"{tuple_delimiter}"严重的左心衰竭血液再分配时，肾血流量首先减少，可出现少尿。"{tuple_delimiter}"complicates"{tuple_delimiter}7){record_delimiter}
  ("relationship"{tuple_delimiter}"少尿"{tuple_delimiter}"肾功能损害"{tuple_delimiter}"长期慢性的肾血流量减少、肾静脉压力升高可导致肾功能不全。"{tuple_delimiter}"并发症"{tuple_delimiter}8){record_delimiter}
  ("relationship"{tuple_delimiter}"左心衰竭"{tuple_delimiter}"心脏扩大"{tuple_delimiter}"左心衰竭可导致心脏扩大，这是其典型体征之一。"{tuple_delimiter}"病理机制"{tuple_delimiter}7){record_delimiter}
  ("relationship"{tuple_delimiter}"左心衰竭"{tuple_delimiter}"心率增快"{tuple_delimiter}"左心衰竭导致心排血量减少，引起代偿性心率增快。"{tuple_delimiter}"代偿机制"{tuple_delimiter}7){record_delimiter}
  ("content_keywords"{tuple_delimiter}"左心衰竭, 呼吸困难, 咳嗽, 咳痰, 咯血, 心脏体征"){completion_delimiter}
  #############################`,
    inputVariables: [
      "tuple_delimiter",
      "completion_delimiter",
      "record_delimiter",
    ],
  }),
  EXTRACT_PATHOPHYSIOLOGY: new PromptTemplate({
    template: `EXTRACT_PATHOPHYSIOLOGY:
    
    Entity_types: [pathophysiology, pathogenesis, pathology_change, cell, chemical, biological_process, hormone, indicator]
      Text:
  \`\`\`
  肝细胞通过合成与分解糖原、糖酵解与糖异生来维持血糖的相对稳定，肝细胞功能不全时可导致低血糖，其机制包括：肝细胞大量死亡使肝糖原贮备明显减少、糖原合成障碍及糖异生能力下降；受损肝细胞内质网葡萄糖 - 6- 磷酸酶活性降低，肝糖原转化为葡萄糖过程障碍；肝细胞灭活胰岛素功能降低，血中胰岛素含量增加。部分肝功能障碍患者由于糖利用障碍也可出现糖耐量降低。
  \`\`\`
  
  Output:
  ("entity"{tuple_delimiter}"肝细胞"{tuple_delimiter}"cell"{tuple_delimiter}"肝细胞是肝脏的基本功能单位，负责合成与分解糖原、糖酵解与糖异生。"){record_delimiter}
  ("entity"{tuple_delimiter}"低血糖"{tuple_delimiter}"pathophysiology"{tuple_delimiter}"低血糖是肝细胞功能不全时的表现，其机制包括肝细胞大量死亡、糖原合成障碍及糖异生能力下降。"){record_delimiter}
  ("entity"{tuple_delimiter}"肝糖原"{tuple_delimiter}"chemical"{tuple_delimiter}"肝糖原是肝细胞内储存的糖原，负责维持血糖的相对稳定。"){record_delimiter}
  ("entity"{tuple_delimiter}"糖原合成"{tuple_delimiter}"biochemistry"{tuple_delimiter}"糖原合成是肝细胞功能的一个重要方面，肝细胞功能不全时糖原合成障碍。"){record_delimiter}
  ("entity"{tuple_delimiter}"糖异生"{tuple_delimiter}"biochemistry"{tuple_delimiter}"糖异生是肝细胞功能的一个重要方面，肝细胞功能不全时糖异生能力下降。"){record_delimiter}
  ("entity"{tuple_delimiter}"糖酵解"{tuple_delimiter}"biochemistry"{tuple_delimiter}"糖酵解是肝细胞功能的一个重要方面，肝细胞功能不全时糖酵解能力下降。"){record_delimiter}
  ("entity"{tuple_delimiter}"葡萄糖 - 6- 磷酸酶"{tuple_delimiter}"chemical"{tuple_delimiter}"葡萄糖 - 6- 磷酸酶是肝细胞内质网中的一种酶，负责将肝糖原转化为葡萄糖。"){record_delimiter}
  ("entity"{tuple_delimiter}"胰岛素"{tuple_delimiter}"hormone"{tuple_delimiter}"胰岛素是调节血糖水平的激素，肝细胞功能不全时其灭活功能降低。"){record_delimiter}
  ("entity"{tuple_delimiter}"糖耐量"{tuple_delimiter}"indicator"{tuple_delimiter}"糖耐量是指机体对葡萄糖的耐受能力，肝功能障碍患者可出现糖耐量降低。"){record_delimiter}
  ("relationship"{tuple_delimiter}"肝细胞"{tuple_delimiter}"低血糖"{tuple_delimiter}"肝细胞功能不全时可导致低血糖，其机制包括肝细胞大量死亡、糖原合成障碍及糖异生能力下降。"{tuple_delimiter}"病理机制, 病理生理"{tuple_delimiter}9){record_delimiter}
  ("relationship"{tuple_delimiter}"肝细胞"{tuple_delimiter}"肝糖原"{tuple_delimiter}"肝细胞通过合成与分解糖原来维持血糖的相对稳定。"{tuple_delimiter}"病理机制, 病理生理"{tuple_delimiter}8){record_delimiter}
  ("relationship"{tuple_delimiter}"肝细胞"{tuple_delimiter}"糖原合成"{tuple_delimiter}"肝细胞通过糖原合成来维持血糖的相对稳定。"{tuple_delimiter}"病理机制, 病理生理"{tuple_delimiter}8){record_delimiter}
  ("relationship"{tuple_delimiter}"肝细胞"{tuple_delimiter}"糖异生"{tuple_delimiter}"肝细胞通过糖异生来维持血糖的相对稳定。"{tuple_delimiter}"病理机制, 病理生理"{tuple_delimiter}8){record_delimiter}
  ("relationship"{tuple_delimiter}"肝细胞"{tuple_delimiter}"糖酵解"{tuple_delimiter}"肝细胞通过糖酵解来维持血糖的相对稳定。"{tuple_delimiter}"病理机制, 病理生理"{tuple_delimiter}8){record_delimiter}
  ("relationship"{tuple_delimiter}"肝细胞"{tuple_delimiter}"葡萄糖 - 6- 磷酸酶"{tuple_delimiter}"肝细胞内质网中的葡萄糖 - 6- 磷酸酶活性降低，导致肝糖原转化为葡萄糖的过程障碍。"{tuple_delimiter}"病理机制, 病理生理"{tuple_delimiter}8){record_delimiter}
  ("relationship"{tuple_delimiter}"肝细胞"{tuple_delimiter}"胰岛素"{tuple_delimiter}"肝细胞功能不全时，胰岛素的灭活功能降低，血中胰岛素含量增加。"{tuple_delimiter}"病理机制, 病理生理"{tuple_delimiter}8){record_delimiter}
  ("relationship"{tuple_delimiter}"肝细胞"{tuple_delimiter}"糖耐量"{tuple_delimiter}"部分肝功能障碍患者由于糖利用障碍也可出现糖耐量降低。"{tuple_delimiter}"病理机制, 病理生理"{tuple_delimiter}8){record_delimiter}
  ("relationship"{tuple_delimiter}"低血糖"{tuple_delimiter}"肝糖原"{tuple_delimiter}"低血糖是肝细胞功能不全时的表现，其机制包括肝细胞大量死亡、糖原合成障碍及糖异生能力下降。"{tuple_delimiter}"病理机制, 病理生理"{tuple_delimiter}9){record_delimiter}
  ("relationship"{tuple_delimiter}"低血糖"{tuple_delimiter}"糖原合成"{tuple_delimiter}"低血糖是肝细胞功能不全时的表现，其机制包括肝细胞大量死亡、糖原合成障碍及糖异生能力下降。"{tuple_delimiter}"病理机制, 病理生理"{tuple_delimiter}9){record_delimiter}
  ("relationship"{tuple_delimiter}"低血糖"{tuple_delimiter}"糖异生"{tuple_delimiter}"低血糖是肝细胞功能不全时的表现，其机制包括肝细胞大量死亡、糖原合成障碍及糖异生能力下降。"{tuple_delimiter}"病理机制, 病理生理"{tuple_delimiter}9){record_delimiter}
  ("relationship"{tuple_delimiter}"低血糖"{tuple_delimiter}"糖酵解"{tuple_delimiter}"低血糖是肝细胞功能不全时的表现，其机制包括肝细胞大量死亡、糖原合成障碍及糖异生能力下降。"{tuple_delimiter}"病理机制, 病理生理"{tuple_delimiter}9){record_delimiter}
  ("relationship"{tuple_delimiter}"低血糖"{tuple_delimiter}"葡萄糖 - 6- 磷酸酶"{tuple_delimiter}"低血糖是肝细胞功能不全时的表现，其机制包括肝细胞大量死亡、糖原合成障碍及糖异生能力下降。"{tuple_delimiter}"病理机制, 病理生理"{tuple_delimiter}9){record_delimiter}
  ("relationship"{tuple_delimiter}"低血糖"{tuple_delimiter}"胰岛素"{tuple_delimiter}"低血糖是肝细胞功能不全时的表现，其机制包括肝细胞大量死亡、糖原合成障碍及糖异生能力下降。"{tuple_delimiter}"病理机制, 病理生理"{tuple_delimiter}9){record_delimiter}`,
    inputVariables: [
      "tuple_delimiter",
      "completion_delimiter",
      "record_delimiter",
    ],
  }),
};

export const ENTITY_TYPES: Record<string, PromptTemplate> = {
  DEFAULT_ENTITY_TYPES: new PromptTemplate({
    template: ``,
    inputVariables: [],
  }),
};

export const ENTITY_EXTRACTION_EXAMPLE_2: Record<string, PromptTemplate> = {
  EXTRACT_CLINICAL_PRESENTATION: new PromptTemplate({
    template: `EXTRACT_CLINICAL_PRESENTATION:
  
  Entity_types: [symptom, sign, disease]
  Text:
  \`\`\`
  左心衰竭以肺循环淤血及心排血量降低为主要表现。 1. 症状 （1）不同程度的呼吸困难：①劳力性呼吸困难：是左心衰竭最早出现的症状。因运动使回心血量增加，左心房压力升高，肺淤血加重。随心衰程度的加重，病人活动耐量进行性减退。②夜间阵发性呼吸困难：病人入睡后突然因憋气而惊醒，被迫取坐位，多于端坐休息后缓解。其发生机制除睡眠平卧时血液重新分配使肺血量增加外，夜间迷走神经张力增加、小支气管收缩、横膈抬高、肺活量减少等也是促发因素。③端坐呼吸：肺淤血达到一定程度时，病人不能平卧，因平卧时回心血量增多且横膈上抬，呼吸更为困难。高枕卧位、半卧位甚至端坐时方可好转。④急性肺水肿：是左心衰竭呼吸困难最严重的形式，可有哮鸣音，称为"心源性哮喘"。
  \`\`\`
  
  Output:
  ("entity"{tuple_delimiter}"左心衰竭"{tuple_delimiter}"disease"{tuple_delimiter}"左心衰竭是一种心血管疾病，以肺循环淤血及心排血量降低为主要表现。"){record_delimiter}
  ("entity"{tuple_delimiter}"呼吸困难"{tuple_delimiter}"symptom"{tuple_delimiter}"呼吸困难是一种症状，在左心衰中严重程度不同。"){record_delimiter}
  ("entity"{tuple_delimiter}"劳力性呼吸困难"{tuple_delimiter}"symptom"{tuple_delimiter}"劳力性呼吸困难是一种呼吸困难，是左心衰竭最早出现的症状。因运动使回心血量增加，左心房压力升高，肺淤血加重。随心衰程度的加重，病人活动耐量进行性减退。"){record_delimiter}
  ("relationship"{tuple_delimiter}"左心衰竭"{tuple_delimiter}"呼吸困难"{tuple_delimiter}"左心衰竭导致肺循环淤血，引起不同程度的呼吸困难症状。"{tuple_delimiter}"has_symptom"{tuple_delimiter}9){record_delimiter}
  ("relationship"{tuple_delimiter}"左心衰竭"{tuple_delimiter}"劳力性呼吸困难"{tuple_delimiter}"左心衰竭时病人活动耐量进行性减退，出现劳力性呼吸困难"{tuple_delimiter}"has_symptom"{tuple_delimiter}9){record_delimiter}
  ("relationship"{tuple_delimiter}"呼吸困难"{tuple_delimiter}"端坐呼吸"{tuple_delimiter}"呼吸困难严重时表现为端坐呼吸，因平卧时回心血量增多且横膈上抬，呼吸更为困难。"{tuple_delimiter}"progresses_to"{tuple_delimiter}7){record_delimiter}
  ("content_keywords"{tuple_delimiter}"左心衰竭, 呼吸困难"){completion_delimiter}
  #############################`,
    inputVariables: [
      "tuple_delimiter",
      "completion_delimiter",
      "record_delimiter",
    ],
  }),
  EXTRACT_PATHOPHYSIOLOGY: new PromptTemplate({
    template: `EXTRACT_PATHOPHYSIOLOGY:
    
    Entity_types: [pathophysiology, pathogenesis, pathology_change, cell, chemical, biological_process, hormone, indicator]
      Text:
  \`\`\`
  肝细胞通过合成与分解糖原、糖酵解与糖异生来维持血糖的相对稳定，肝细胞功能不全时可导致低血糖，其机制包括：肝细胞大量死亡使肝糖原贮备明显减少、糖原合成障碍及糖异生能力下降；受损肝细胞内质网葡萄糖 - 6- 磷酸酶活性降低，肝糖原转化为葡萄糖过程障碍；肝细胞灭活胰岛素功能降低，血中胰岛素含量增加。部分肝功能障碍患者由于糖利用障碍也可出现糖耐量降低。
  \`\`\`
  
  Output:
  ("entity"{tuple_delimiter}"肝细胞"{tuple_delimiter}"cell"{tuple_delimiter}"肝细胞是肝脏的基本功能单位，负责合成与分解糖原、糖酵解与糖异生。"){record_delimiter}
  ("entity"{tuple_delimiter}"低血糖"{tuple_delimiter}"pathophysiology"{tuple_delimiter}"低血糖是肝细胞功能不全时的表现，其机制包括肝细胞大量死亡、糖原合成障碍及糖异生能力下降。"){record_delimiter}
  ("entity"{tuple_delimiter}"肝糖原"{tuple_delimiter}"chemical"{tuple_delimiter}"肝糖原是肝细胞内储存的糖原，负责维持血糖的相对稳定。"){record_delimiter}
  ("entity"{tuple_delimiter}"糖原合成"{tuple_delimiter}"biochemistry"{tuple_delimiter}"糖原合成是肝细胞功能的一个重要方面，肝细胞功能不全时糖原合成障碍。"){record_delimiter}
  ("entity"{tuple_delimiter}"糖异生"{tuple_delimiter}"biochemistry"{tuple_delimiter}"糖异生是肝细胞功能的一个重要方面，肝细胞功能不全时糖异生能力下降。"){record_delimiter}
  ("entity"{tuple_delimiter}"糖酵解"{tuple_delimiter}"biochemistry"{tuple_delimiter}"糖酵解是肝细胞功能的一个重要方面，肝细胞功能不全时糖酵解能力下降。"){record_delimiter}
  ("entity"{tuple_delimiter}"葡萄糖 - 6- 磷酸酶"{tuple_delimiter}"chemical"{tuple_delimiter}"葡萄糖 - 6- 磷酸酶是肝细胞内质网中的一种酶，负责将肝糖原转化为葡萄糖。"){record_delimiter}
  ("entity"{tuple_delimiter}"胰岛素"{tuple_delimiter}"hormone"{tuple_delimiter}"胰岛素是调节血糖水平的激素，肝细胞功能不全时其灭活功能降低。"){record_delimiter}
  ("entity"{tuple_delimiter}"糖耐量"{tuple_delimiter}"indicator"{tuple_delimiter}"糖耐量是指机体对葡萄糖的耐受能力，肝功能障碍患者可出现糖耐量降低。"){record_delimiter}
  ("relationship"{tuple_delimiter}"肝细胞"{tuple_delimiter}"低血糖"{tuple_delimiter}"肝细胞功能不全时可导致低血糖，其机制包括肝细胞大量死亡、糖原合成障碍及糖异生能力下降。"{tuple_delimiter}"病理机制, 病理生理"{tuple_delimiter}9){record_delimiter}
  ("relationship"{tuple_delimiter}"肝细胞"{tuple_delimiter}"肝糖原"{tuple_delimiter}"肝细胞通过合成与分解糖原来维持血糖的相对稳定。"{tuple_delimiter}"病理机制, 病理生理"{tuple_delimiter}8){record_delimiter}
  ("relationship"{tuple_delimiter}"肝细胞"{tuple_delimiter}"糖原合成"{tuple_delimiter}"肝细胞通过糖原合成来维持血糖的相对稳定。"{tuple_delimiter}"病理机制, 病理生理"{tuple_delimiter}8){record_delimiter}
  ("relationship"{tuple_delimiter}"肝细胞"{tuple_delimiter}"糖异生"{tuple_delimiter}"肝细胞通过糖异生来维持血糖的相对稳定。"{tuple_delimiter}"病理机制, 病理生理"{tuple_delimiter}8){record_delimiter}
  ("relationship"{tuple_delimiter}"肝细胞"{tuple_delimiter}"糖酵解"{tuple_delimiter}"肝细胞通过糖酵解来维持血糖的相对稳定。"{tuple_delimiter}"病理机制, 病理生理"{tuple_delimiter}8){record_delimiter}
  ("relationship"{tuple_delimiter}"肝细胞"{tuple_delimiter}"葡萄糖 - 6- 磷酸酶"{tuple_delimiter}"肝细胞内质网中的葡萄糖 - 6- 磷酸酶活性降低，导致肝糖原转化为葡萄糖的过程障碍。"{tuple_delimiter}"病理机制, 病理生理"{tuple_delimiter}8){record_delimiter}
  ("relationship"{tuple_delimiter}"肝细胞"{tuple_delimiter}"胰岛素"{tuple_delimiter}"肝细胞功能不全时，胰岛素的灭活功能降低，血中胰岛素含量增加。"{tuple_delimiter}"病理机制, 病理生理"{tuple_delimiter}8){record_delimiter}
  ("relationship"{tuple_delimiter}"肝细胞"{tuple_delimiter}"糖耐量"{tuple_delimiter}"部分肝功能障碍患者由于糖利用障碍也可出现糖耐量降低。"{tuple_delimiter}"病理机制, 病理生理"{tuple_delimiter}8){record_delimiter}
  ("relationship"{tuple_delimiter}"低血糖"{tuple_delimiter}"肝糖原"{tuple_delimiter}"低血糖是肝细胞功能不全时的表现，其机制包括肝细胞大量死亡、糖原合成障碍及糖异生能力下降。"{tuple_delimiter}"病理机制, 病理生理"{tuple_delimiter}9){record_delimiter}
  ("relationship"{tuple_delimiter}"低血糖"{tuple_delimiter}"糖原合成"{tuple_delimiter}"低血糖是肝细胞功能不全时的表现，其机制包括肝细胞大量死亡、糖原合成障碍及糖异生能力下降。"{tuple_delimiter}"病理机制, 病理生理"{tuple_delimiter}9){record_delimiter}
  ("relationship"{tuple_delimiter}"低血糖"{tuple_delimiter}"糖异生"{tuple_delimiter}"低血糖是肝细胞功能不全时的表现，其机制包括肝细胞大量死亡、糖原合成障碍及糖异生能力下降。"{tuple_delimiter}"病理机制, 病理生理"{tuple_delimiter}9){record_delimiter}
  ("relationship"{tuple_delimiter}"低血糖"{tuple_delimiter}"糖酵解"{tuple_delimiter}"低血糖是肝细胞功能不全时的表现，其机制包括肝细胞大量死亡、糖原合成障碍及糖异生能力下降。"{tuple_delimiter}"病理机制, 病理生理"{tuple_delimiter}9){record_delimiter}
  ("relationship"{tuple_delimiter}"低血糖"{tuple_delimiter}"葡萄糖 - 6- 磷酸酶"{tuple_delimiter}"低血糖是肝细胞功能不全时的表现，其机制包括肝细胞大量死亡、糖原合成障碍及糖异生能力下降。"{tuple_delimiter}"病理机制, 病理生理"{tuple_delimiter}9){record_delimiter}
  ("relationship"{tuple_delimiter}"低血糖"{tuple_delimiter}"胰岛素"{tuple_delimiter}"低血糖是肝细胞功能不全时的表现，其机制包括肝细胞大量死亡、糖原合成障碍及糖异生能力下降。"{tuple_delimiter}"病理机制, 病理生理"{tuple_delimiter}9){record_delimiter}`,
    inputVariables: [
      "tuple_delimiter",
      "completion_delimiter",
      "record_delimiter",
    ],
  }),
};

export const CONTINUE_ENTITY_EXTRACTION: Record<string, PromptTemplate> = {
  DEFAULT: new PromptTemplate({
    template: `Given the original text and a list of entities that were previously extracted but did not have any relationships identified, review the original text again to find relationships for these specific entities.
    Use {language} as output language.

    ---Steps---
    1. For each entity in the provided list, search the original text to find if it has a relationship with any other entity (either from the provided list or from the original extraction).
    2. For each pair of related entities found, extract the following information:
    - source_entity: name of the source entity
    - target_entity: name of the target entity
    - relationship_description: explanation as to why you think the source entity and the target entity are related to each other
    - relationship_strength: a numeric score indicating strength of the relationship between the source entity and target entity
    - relationship_keywords: one or more high-level key words that summarize the overarching nature of the relationship
    Format each relationship as ("relationship"{tuple_delimiter}<source_entity>{tuple_delimiter}<target_entity>{tuple_delimiter}<relationship_description>{tuple_delimiter}<relationship_keywords>{tuple_delimiter}<relationship_strength>)

    3. If you identify any new entities that were missed in the initial extraction while looking for relationships for the isolated entities, extract them as well using the following format:
    - entity_name: Name of the entity
    - entity_type: One of the following types: [{entity_types}]
    - entity_description: Comprehensive description of the entity's attributes and activities
    Format each entity as ("entity"{tuple_delimiter}<entity_name>{tuple_delimiter}<entity_type>{tuple_delimiter}<entity_description>)

    4. Return output in {language} as a single list of all the new entities and relationships identified in steps 2 and 3. Use **{record_delimiter}** as the list delimiter.

    5. When finished, output {completion_delimiter}

    #############################
    ---Real Data---
    ######################
    Entity_types: [{entity_types}]
    Isolated Entities: [{isolated_entities}]
    Text:
    {input_text}
    ######################
    Output:`,
    inputVariables: [
      "language",
      "entity_types",
      "tuple_delimiter",
      "record_delimiter",
      "completion_delimiter",
      "isolated_entities",
      "input_text",
    ],
  }),
};
