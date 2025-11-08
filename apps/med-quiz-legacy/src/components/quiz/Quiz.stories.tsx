import type { Meta, StoryObj } from "@storybook/nextjs";
import { SessionProvider } from "next-auth/react";

import Quiz from "./Quiz";
import { A1, A2, A3, B, X } from "../../types/quizData.types";

const meta = {
  component: Quiz,
  decorators: [
    (Story) => (
      <SessionProvider
        session={{ expires: "1", user: { email: "test@example.com" } }}
      >
        <div id="__next">
          <Story />
        </div>
      </SessionProvider>
    ),
  ],
} satisfies Meta<typeof Quiz>;

export default meta;

type Story = StoryObj<typeof meta>;

// Mock functions for required props
const mockHandleBackToGrid = () => console.log("Back to grid");
const mockBack = () => console.log("Back");
const mockForward = () => console.log("Forward");
const mockOnAnswerChange = async () => console.log("Answer changed");
const mockOnSimilarQuizzesFound = () => console.log("Similar quizzes found");

// Common props for all stories
const commonProps = {
  handleBackToGrid: mockHandleBackToGrid,
  currentQuizIndex: 0,
  thisQuizIndex: 0,
  back: mockBack,
  forward: mockForward,
  onAnswerChange: mockOnAnswerChange,
  onSimilarQuizzesFound: mockOnSimilarQuizzesFound,
  isTestMode: false,
};

// A1 Question Type
const testA1Quiz: A1 = {
  _id: "a1-sample-id",
  type: "A1",
  class: "生理学",
  unit: "第一章 绪论",
  tags: ["基础", "体液"],
  question: "2010N1A 关于体液的叙述正确的是",
  options: [
    {
      oid: "A",
      text: "A.分布在各部分的体液量大体相等",
    },
    {
      oid: "B",
      text: "B.各部分体液彼此隔开又相互沟通",
    },
    {
      oid: "C",
      text: "C.各部分体液的成分几乎没有差别",
    },
    {
      oid: "D",
      text: "D.各部分体液中最活跃的是细胞内液",
    },
  ],
  answer: "B",
  analysis: {
    point: "体液的分布与功能",
    discuss:
      "体液包括细胞内液和细胞外液，其中细胞内液占体重的40%，细胞外液占20%，两者之间通过细胞膜进行物质交换。",
    link: [],
  },
  source: "2010年全国硕士研究生入学考试西医综合科目",
};

// A1 Question Type - Submitted State
const testA1QuizSubmitted: any = {
  ...testA1Quiz,
  userAnswer: "B", // Correct answer
};

// A2 Question Type
const testA2Quiz: A2 = {
  _id: "a2-sample-id",
  type: "A2",
  class: "病理学",
  unit: "第二章 细胞和组织的适应与损伤",
  tags: ["病理", "细胞损伤"],
  question:
    "患者，男，50岁。因持续性胸痛2小时入院。心电图示ST段抬高，肌钙蛋白升高。最可能的诊断是",
  options: [
    {
      oid: "A",
      text: "A.稳定型心绞痛",
    },
    {
      oid: "B",
      text: "B.不稳定型心绞痛",
    },
    {
      oid: "C",
      text: "C.急性心肌梗死",
    },
    {
      oid: "D",
      text: "D.主动脉夹层",
    },
  ],
  answer: "C",
  analysis: {
    point: "急性心肌梗死的诊断",
    discuss: "持续性胸痛伴ST段抬高和肌钙蛋白升高是急性心肌梗死的典型表现。",
    link: [],
  },
  source: "临床案例",
};

// A3 Question Type
const testA3Quiz: A3 = {
  _id: "a3-sample-id",
  type: "A3",
  class: "内科学",
  unit: "心血管系统",
  tags: ["心血管", "病例分析"],
  mainQuestion:
    "患者，男，65岁。因突发胸痛3小时入院。查体：血压90/60mmHg，心率120次/分，律齐。心电图示V1-V5导联ST段抬高。",
  subQuizs: [
    {
      subQuizId: 1,
      question: "1. 最可能的诊断是",
      options: [
        {
          oid: "A",
          text: "A.急性心肌梗死",
        },
        {
          oid: "B",
          text: "B.主动脉夹层",
        },
        {
          oid: "C",
          text: "C.肺栓塞",
        },
        {
          oid: "D",
          text: "D.心包填塞",
        },
      ],
      answer: "A",
    },
    {
      subQuizId: 2,
      question: "2. 首选的治疗措施是",
      options: [
        {
          oid: "A",
          text: "A.溶栓治疗",
        },
        {
          oid: "B",
          text: "B.急诊PCI",
        },
        {
          oid: "C",
          text: "C.抗凝治疗",
        },
        {
          oid: "D",
          text: "D.镇痛治疗",
        },
      ],
      answer: "B",
    },
  ],
  analysis: {
    point: "急性心肌梗死的诊断与治疗",
    discuss:
      "根据患者的症状、体征和心电图表现，最可能的诊断是急性心肌梗死。首选治疗是急诊PCI。",
    link: [],
  },
  source: "临床案例",
};

// B Question Type
const testBQuiz: B = {
  _id: "b-sample-id",
  type: "B",
  class: "药理学",
  unit: "心血管药物",
  tags: ["药理", "心血管药物"],
  questions: [
    {
      questionId: 1,
      questionText: "1. 主要用于治疗高血压的药物是",
      answer: "A",
    },
    {
      questionId: 2,
      questionText: "2. 主要用于治疗心力衰竭的药物是",
      answer: "B",
    },
  ],
  options: [
    {
      oid: "A",
      text: "A.卡托普利",
    },
    {
      oid: "B",
      text: "B.地高辛",
    },
    {
      oid: "C",
      text: "C.阿司匹林",
    },
    {
      oid: "D",
      text: "D.硝酸甘油",
    },
  ],
  analysis: {
    point: "心血管药物的适应症",
    discuss:
      "卡托普利是ACE抑制剂，主要用于治疗高血压；地高辛是强心苷类药物，主要用于治疗心力衰竭。",
    link: [],
  },
  source: "药理学教材",
};

// X Question Type (Multiple Choice)
const testXQuiz: X = {
  _id: "x-sample-id",
  type: "X",
  class: "生理学",
  unit: "循环系统",
  tags: ["生理", "循环系统"],
  question: "以下哪些因素能增加心输出量？",
  options: [
    {
      oid: "A",
      text: "A.心率加快",
    },
    {
      oid: "B",
      text: "B.前负荷增加",
    },
    {
      oid: "C",
      text: "C.心肌收缩力增强",
    },
    {
      oid: "D",
      text: "D.后负荷增加",
    },
    {
      oid: "E",
      text: "E.静脉回流速度加快",
    },
  ],
  answer: ["A", "B", "C", "E"],
  analysis: {
    point: "心输出量的调节因素",
    discuss:
      "心输出量=心率×每搏输出量。心率加快、前负荷增加、心肌收缩力增强都能增加心输出量。后负荷增加会减少心输出量。静脉回流速度加快能增加前负荷，从而增加心输出量。",
    link: [],
  },
  source: "生理学教材",
};

export const A1Question: Story = {
  args: {
    ...commonProps,
    quiz: testA1Quiz,
  },
};

export const A2Question: Story = {
  args: {
    ...commonProps,
    quiz: testA2Quiz,
  },
};

export const A3Question: Story = {
  args: {
    ...commonProps,
    quiz: testA3Quiz,
  },
};

// A3 Question Type - Submitted State
const testA3QuizSubmitted: any = {
  ...testA3Quiz,
  userAnswer: {
    1: "A", // Correct answer
    2: "C", // Incorrect answer
  },
};

export const A3QuestionSubmitted: Story = {
  args: {
    ...commonProps,
    quiz: testA3QuizSubmitted,
  },
};

// B Question Type - Submitted State
const testBQuizSubmitted: any = {
  ...testBQuiz,
  userAnswer: {
    1: "A", // Correct answer
    2: "C", // Incorrect answer
  },
};

export const BQuestionSubmitted: Story = {
  args: {
    ...commonProps,
    quiz: testBQuizSubmitted,
  },
};

export const BQuestion: Story = {
  args: {
    ...commonProps,
    quiz: testBQuiz,
  },
};

export const XQuestion: Story = {
  args: {
    ...commonProps,
    quiz: testXQuiz,
  },
};

export const XQuestionWithSelection: Story = {
  args: {
    ...commonProps,
    quiz: {
      ...testXQuiz,
      userAnswer: ["A", "B"], // Pre-selecting options A and B to demonstrate the rounded square icon
    },
  },
};

export const A1QuestionSubmitted: Story = {
  args: {
    ...commonProps,
    quiz: testA1QuizSubmitted,
  },
};
