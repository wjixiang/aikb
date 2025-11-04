import { NextResponse } from 'next/server';
import { BaiduOCR } from '@/lib/ocr/baidu';
import { PromptTemplate } from '@langchain/core/prompts';
import { getChatModel } from '@/lib/langchain/provider';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const imageFiles = formData.getAll('images') as File[];

    if (!imageFiles || imageFiles.length === 0) {
      return NextResponse.json(
        { error: 'No image files provided' },
        { status: 400 },
      );
    }

    // Process all images in order
    const results = await Promise.all(
      imageFiles.map(async (file) => {
        const buffer = Buffer.from(await file.arrayBuffer());
        return await BaiduOCR.processImage(buffer);
      }),
    );

    // Combine results with newlines between them
    let combinedText = results.join('\n\n');

    // Step 1: Clean OCR text with LLM
    const llm = getChatModel()('gpt-4o-mini', 0);

    const cleanPrompt = PromptTemplate.fromTemplate(`
      请清理以下OCR识别文本：
      1. 去除重复内容
      2. 修正错别字
      3. 规范格式
      
      原始文本: {text}
    `);

    const cleanChain = cleanPrompt.pipe(llm);
    const cleanResponse = await cleanChain.invoke({ text: combinedText });
    const cleanedText =
      typeof cleanResponse.content === 'string'
        ? cleanResponse.content
        : JSON.stringify(cleanResponse.content);

    // Step 2: Extract structured medical record
    const extractPrompt = PromptTemplate.fromTemplate(`
      请从以下病历文本中提取结构化信息，严格按照要求格式返回JSON数据：
      
      1. 一般项目：
      {{
        "姓名": "",
        "性别": "",
        "年龄": "",
        "民族": "",
        "婚姻状况": "",
        "出生地": "",
        "职业": "",
        "工作单位": "",
        "住址": "",
        "入院时间": "",
        "入院方式": "",
        "记录时间": "",
        "病史陈述者": ""
      }}
      
      2. 主诉：
      {{
        "主要症状": [],
        "症状持续时间": ""
      }}
      
      3. 现病史：
      {{
        "发病诱因": "",
        "临床症状": {{
          "主要症状": {{
            "强度": "",
            "类型": "",
            "部位": "",
            "性状": "",
            "次数": "",
            "缓急": "",
            "时间": "",
            "加重或缓解因素": ""
          }},
          "伴随症状": {{
            "与症状相关的变化": "",
            "与鉴别诊断有关的主要阳性症状和阴性症状": ""
          }}
        }},
        "诊疗经过": {{
          "诊疗机构信息": "",
          "辅助检查情况及结果": "",
          "治疗情况及结果": {{
            "药物治疗": {{
              "用药情况": "",
              "疗效及病情演变": ""
            }},
            "手术治疗": {{
              "具体术式": "",
              "疗效及病情演变": ""
            }}
          }}
        }},
        "一般情况": {{
          "饮食": "",
          "睡眠": "",
          "大小便": "",
          "体重": "",
          "精神状态": ""
        }}
      }}
      
      4. 既往史：
      {{
        "疾病史及诊疗史": "",
        "过敏史": "",
        "手术外伤史": "",
        "传染病史": {{
          "结核病史": "",
          "乙肝病史": ""
        }},
        "冶游史": "",
        "疫水接触史": "",
        "预防接种史": ""
      }}
      
      5. 系统回顾：
      {{
        "呼吸系统": "",
        "循环系统": "",
        "消化系统": "",
        "泌尿生殖系统": "",
        "造血系统": "",
        "内分泌及代谢系统": "",
        "神经精神系统": "",
        "运动系统": ""
      }}
      
      6. 个人史：
      {{
        "居住地": "",
        "不良嗜好史": "",
        "婚育史": "",
        "职业暴露史": ""
      }}
      
      7. 月经婚育史：
      {{
        "月经史": "",
        "婚育史": ""
      }}
      
      8. 家族史：
      {{
        "家族病史": ""
      }}
      
      病历文本: {text}
    `);

    const extractChain = extractPrompt.pipe(llm);
    const extractResponse = await extractChain.invoke({ text: cleanedText });
    const extractedData =
      typeof extractResponse.content === 'string'
        ? extractResponse.content
        : JSON.stringify(extractResponse.content);

    // Clean JSON string by removing markdown code blocks
    const cleanJsonString = extractedData
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();

    let structuredData;
    try {
      structuredData = JSON.parse(cleanJsonString);
      console.log(structuredData);
    } catch (e) {
      console.error('Failed to parse extracted data:', e);
      structuredData = { error: 'Failed to parse extracted data' };
    }

    // Step 3: Format structured data into readable document
    const formatPrompt = PromptTemplate.fromTemplate(`
      请将以下结构化病历数据转换为格式规范的入院病历文档：
      
      入院病历
      姓名：{{姓名}}
      性别：{{性别}}
      年龄：{{年龄}}
      出生地：{{出生地}}
      职业：{{职业}}
      入院时间：{{入院时间}}
      民族：{{民族}}
      婚姻状况：{{婚姻状况}}
      记录时间：{{记录时间}}
      
      主诉：{{主诉}}
      
      现病史：
      {{现病史}}
      
      既往史：
      {{既往史}}
      
      系统回顾：
      {{系统回顾}}
      
      个人史：
      {{个人史}}
      
      月经婚育史：
      {{月经婚育史}}
      
      家族史：
      {{家族史}}
      
      请严格按照标准病历格式组织内容，保持专业性和可读性。
      
      结构化数据: \${JSON.stringify(structuredData, null, 2)}
    `);

    const formatChain = formatPrompt.pipe(llm);
    const formatResponse = await formatChain.invoke({
      姓名: structuredData?.姓名 || '',
      性别: structuredData?.性别 || '',
      年龄: structuredData?.年龄 || '',
      出生地: structuredData?.出生地 || '',
      职业: structuredData?.职业 || '',
      入院时间: structuredData?.入院时间 || '',
      民族: structuredData?.民族 || '',
      婚姻状况: structuredData?.婚姻状况 || '',
      记录时间: structuredData?.记录时间 || '',
      主诉: structuredData?.主诉 || '',
      现病史: structuredData?.现病史
        ? JSON.stringify(structuredData.现病史)
        : '',
      既往史: structuredData?.既往史
        ? JSON.stringify(structuredData.既往史)
        : '',
      系统回顾: structuredData?.系统回顾
        ? JSON.stringify(structuredData.系统回顾)
        : '',
      个人史: structuredData?.个人史
        ? JSON.stringify(structuredData.个人史)
        : '',
      月经婚育史: structuredData?.月经婚育史
        ? JSON.stringify(structuredData.月经婚育史)
        : '',
      家族史: structuredData?.家族史
        ? JSON.stringify(structuredData.家族史)
        : '',
      'JSON.stringify(structuredData, null, 2)': JSON.stringify(
        structuredData,
        null,
        2,
      ),
    });
    const formattedDocument =
      typeof formatResponse.content === 'string'
        ? formatResponse.content
        : JSON.stringify(formatResponse.content);

    return NextResponse.json({
      originalText: combinedText,
      cleanedText,
      structuredData,
      formattedDocument,
    });
  } catch (error) {
    console.error('OCR processing error:', error);
    return NextResponse.json(
      { error: 'Failed to process image' },
      { status: 500 },
    );
  }
}
