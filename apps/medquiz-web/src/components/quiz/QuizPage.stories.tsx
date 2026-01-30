import React from 'react';
import { Meta, StoryObj } from '@storybook/nextjs';
import QuizPage from './QuizPage';
import { QuizWithUserAnswer, answerType } from '../../types/quizData.types';
import { SessionProvider } from 'next-auth/react';

// Mock quiz data
const mockQuizzes: QuizWithUserAnswer[] = [
  {
    _id: '1',
    type: 'A1',
    class: '内科',
    unit: '心血管系统',
    tags: ['心律失常', '诊断'],
    question: '下列哪项是诊断室性心动过速最有力的证据？',
    options: [
      { oid: 'A', text: 'QRS波群宽大畸形，时间＞0.12秒' },
      { oid: 'B', text: '心室率150-250次/分' },
      { oid: 'C', text: '心室夺获与室性融合波' },
      { oid: 'D', text: '房室分离' },
      { oid: 'E', text: '刺激迷走神经不能终止' },
    ],
    answer: 'C',
    analysis: {
      point: '室性心动过速的诊断要点',
      discuss:
        '室性心动过速的心电图特征包括：①3个或以上的室性QRS波；②QRS波形态畸形，时限增宽＞0.12秒；③心室率通常为100～250次/分；④房室分离；⑤心室夺获与室性融合波。其中，心室夺获与室性融合波是确诊室性心动过速最重要的依据。',
      ai_analysis:
        '室性心动过速是一种严重的心律失常，正确识别其心电图特征对于及时诊断和治疗至关重要。',
      link: [],
    },
    source: '2023年临床执业医师考试大纲',
  },
  {
    _id: '2',
    type: 'A2',
    class: '内科',
    unit: '呼吸系统',
    tags: ['肺炎', '治疗'],
    question:
      '患者男性，65岁，因发热、咳嗽、咳痰3天入院。查体：体温39.5℃，呼吸28次/分，血压85/50mmHg，双肺可闻及湿啰音。血常规：WBC 18×10⁹/L，N 0.85。胸片示右下肺大片状浸润影。最可能的诊断是：',
    options: [
      { oid: 'A', text: '社区获得性肺炎' },
      { oid: 'B', text: '医院获得性肺炎' },
      { oid: 'C', text: '重症肺炎' },
      { oid: 'D', text: '肺脓肿' },
      { oid: 'E', text: '肺结核' },
    ],
    answer: 'C',
    analysis: {
      point: '重症肺炎的诊断标准',
      discuss:
        '患者有发热、咳嗽、咳痰等肺炎症状，胸片显示肺部浸润影，符合肺炎诊断。但患者出现呼吸频率＞30次/分、血压＜90/60mmHg等表现，符合重症肺炎的诊断标准。',
      ai_analysis:
        '重症肺炎的诊断需要结合临床表现、实验室检查和影像学检查，及时识别有助于改善患者预后。',
      link: [],
    },
    source: '2023年临床执业医师考试大纲',
  },
  {
    _id: '3',
    type: 'B',
    class: '内科',
    unit: '消化系统',
    tags: ['肝硬化', '并发症'],
    questions: [
      {
        questionId: 1,
        questionText:
          '患者男性，55岁，有乙肝病史20年。近来出现腹胀、食欲减退。查体：肝掌、蜘蛛痣，腹部膨隆，移动性浊音阳性。该患者最可能的诊断是：',
        answer: 'A',
      },
      {
        questionId: 2,
        questionText: '该患者最常见的并发症是：',
        answer: 'B',
      },
      {
        questionId: 3,
        questionText: '该患者最适宜的治疗是：',
        answer: 'C',
      },
    ],
    options: [
      { oid: 'A', text: '肝硬化' },
      { oid: 'B', text: '上消化道出血' },
      { oid: 'C', text: '保肝治疗' },
      { oid: 'D', text: '肝癌' },
      { oid: 'E', text: '抗病毒治疗' },
    ],
    analysis: {
      point: '肝硬化的诊断与并发症',
      discuss:
        '患者有乙肝病史，出现肝功能减退和门静脉高压的表现（肝掌、蜘蛛痣、腹水），符合肝硬化的诊断。肝硬化最常见的并发症是上消化道出血，主要由食管胃底静脉曲张破裂引起。治疗上需要综合考虑，包括保肝、抗病毒等。',
      ai_analysis:
        '肝硬化是一种常见的慢性肝病，了解其诊断要点和并发症对于临床工作具有重要意义。',
      link: [],
    },
    source: '2023年临床执业医师考试大纲',
  },
  {
    _id: '4',
    type: 'A1',
    class: '内科',
    unit: '内分泌系统',
    tags: ['糖尿病', '诊断'],
    question: '2型糖尿病的诊断标准中，空腹血糖应达到以下哪项水平？',
    options: [
      { oid: 'A', text: '≥7.0 mmol/L' },
      { oid: 'B', text: '≥6.1 mmol/L' },
      { oid: 'C', text: '≥11.1 mmol/L' },
      { oid: 'D', text: '≥5.6 mmol/L' },
      { oid: 'E', text: '≥10.0 mmol/L' },
    ],
    answer: 'A',
    analysis: {
      point: '2型糖尿病的诊断标准',
      discuss:
        '根据国际糖尿病联盟（IDF）和美国糖尿病协会（ADA）的标准，2型糖尿病的诊断标准包括：空腹血糖≥7.0 mmol/L，或随机血糖≥11.1 mmol/L，或糖化血红蛋白≥6.5%。本题考查的是空腹血糖的诊断标准。',
      ai_analysis:
        '糖尿病的早期诊断对预防并发症至关重要，掌握诊断标准有助于临床实践。',
      link: [],
    },
    source: '2023年临床执业医师考试大纲',
  },
  {
    _id: '5',
    type: 'A2',
    class: '内科',
    unit: '泌尿系统',
    tags: ['肾结石', '诊断'],
    question:
      '患者女性，35岁，突发腰痛伴血尿3小时。查体：肾区叩击痛阳性。B超提示右侧输尿管上段结石。最可能的诊断是：',
    options: [
      { oid: 'A', text: '急性膀胱炎' },
      { oid: 'B', text: '急性肾盂肾炎' },
      { oid: 'C', text: '输尿管结石' },
      { oid: 'D', text: '肾癌' },
      { oid: 'E', text: '肾囊肿' },
    ],
    answer: 'C',
    analysis: {
      point: '输尿管结石的临床表现',
      discuss:
        '输尿管结石的典型表现为突发性腰部疼痛，呈阵发性绞痛，可放射至下腹部和会阴部，并伴有血尿。查体可见肾区叩击痛阳性。B超是诊断输尿管结石的重要辅助检查手段。',
      ai_analysis:
        '输尿管结石是泌尿系统常见疾病，及时准确的诊断和处理对缓解患者痛苦非常重要。',
      link: [],
    },
    source: '2023年临床执业医师考试大纲',
  },
  {
    _id: '6',
    type: 'B',
    class: '内科',
    unit: '神经系统',
    tags: ['脑梗死', '诊断'],
    questions: [
      {
        questionId: 1,
        questionText: '脑梗死急性期的治疗原则不包括：',
        answer: 'A',
      },
      {
        questionId: 2,
        questionText: '脑梗死的常见病因不包括：',
        answer: 'B',
      },
      {
        questionId: 3,
        questionText: '脑梗死的危险因素不包括：',
        answer: 'C',
      },
    ],
    options: [
      { oid: 'A', text: '尽早溶栓治疗' },
      { oid: 'B', text: '抗凝治疗' },
      { oid: 'C', text: '降纤治疗' },
      { oid: 'D', text: '控制血压' },
      { oid: 'E', text: '改善脑循环' },
    ],
    analysis: {
      point: '脑梗死的治疗原则和病因',
      discuss:
        '脑梗死急性期治疗原则包括：尽早溶栓治疗、抗凝治疗、降纤治疗、控制血压、改善脑循环等。其中，溶栓治疗是关键措施，需在发病6小时内进行。脑梗死的常见病因包括动脉粥样硬化、心源性栓塞、小血管病变等。危险因素包括高血压、糖尿病、高脂血症、吸烟等。',
      ai_analysis:
        '脑梗死是神经科常见急症，掌握其治疗原则和危险因素对临床诊疗具有重要意义。',
      link: [],
    },
    source: '2023年临床执业医师考试大纲',
  },
];

// Mock functions
const mockOnAnswerChange = async (quizId: string, answer: answerType) => {
  console.log(`Answer changed for quiz ${quizId}:`, answer);
  return Promise.resolve();
};

const mockSetQuizSet = (
  quizSet: React.SetStateAction<QuizWithUserAnswer[]>,
) => {
  console.log('Quiz set updated:', quizSet);
};

const meta: Meta<typeof QuizPage> = {
  title: 'Quiz/QuizPage',
  component: QuizPage,
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (Story) => (
      <SessionProvider
        session={{ expires: '1', user: { email: 'test@example.com' } }}
      >
        <div id="__next">
          <div className="h-screen p-4">
            <Story />
          </div>
        </div>
      </SessionProvider>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof QuizPage>;

export const Default: Story = {
  args: {
    quizSet: mockQuizzes,
    quizSetId: 'mock-quiz-set-id',
    onAnswerChange: mockOnAnswerChange,
    initialAnswers: {},
    setCurrentQuiz: (index: number) =>
      console.log('Current quiz set to:', index),
    setQuizSet: mockSetQuizSet,
    isTestMode: false,
  },
};

export const TestMode: Story = {
  args: {
    ...Default.args,
    isTestMode: true,
  },
};

export const WithInitialAnswers: Story = {
  args: {
    ...Default.args,
    initialAnswers: {
      '1': 'C',
      '2': 'A',
      '4': 'A',
      '5': 'C',
      '6': 'A',
    },
  },
};

export const EmptyQuizSet: Story = {
  args: {
    ...Default.args,
    quizSet: [],
  },
};
