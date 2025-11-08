import React from "react";
import { Meta, StoryObj } from "@storybook/nextjs";
import { QuizTabs } from "./QuizTabs";
import { SessionProvider } from "next-auth/react";

// Mock data for quizzes
const mockQuizzes = [
  {
    _id: "1",
    type: "A1" as const,
    class: " Biology",
    unit: "Cell Biology",
    tags: ["mitosis", "cell division"],
    question: "What is the correct order of mitosis phases?",
    options: [
      { oid: "A", text: "Prophase, Metaphase, Anaphase, Telophase" },
      { oid: "B", text: "Metaphase, Prophase, Anaphase, Telophase" },
      { oid: "C", text: "Anaphase, Telophase, Prophase, Metaphase" },
      { oid: "D", text: "Telophase, Anaphase, Metaphase, Prophase" },
    ],
    answer: "A",
    analysis: {
      point: "Mitosis is the process of cell division",
      discuss: "The correct order is important for proper cell division",
      ai_analysis: "Understanding mitosis is fundamental to cell biology",
      link: [],
    },
    source: "Biology Textbook Chapter 5",
    userAnswer: "A",
  },
  {
    _id: "2",
    type: "A2" as const,
    class: "Biology",
    unit: "Genetics",
    tags: ["dna", "replication"],
    question:
      "Which enzyme is responsible for unwinding the DNA double helix during replication?",
    options: [
      { oid: "A", text: "DNA polymerase" },
      { oid: "B", text: "Helicase" },
      { oid: "C", text: "Ligase" },
      { oid: "D", text: "Primase" },
    ],
    answer: "B",
    analysis: {
      point: "DNA replication requires several enzymes",
      discuss: "Helicase breaks hydrogen bonds between base pairs",
      ai_analysis: "Enzyme functions are crucial for DNA replication",
      link: [],
    },
    source: "Biology Textbook Chapter 7",
    userAnswer: "B",
  },
];

const meta: Meta<typeof QuizTabs> = {
  title: "AI Coach/QuizTabs",
  component: QuizTabs,
  parameters: {
    layout: "fullscreen",
  },
  decorators: [
    (Story) => (
      <SessionProvider
        session={{
          user: {
            name: "Storybook User",
            email: "user@storybook.test",
            image: null,
          },
          expires: "2030-01-01T00:00:00Z",
        }}
      >
        <div className="h-screen p-4">
          <Story />
        </div>
      </SessionProvider>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof QuizTabs>;

export const Default: Story = {
  args: {
    onAnswerChange: async (
      quizId: string,
      answer: any,
      silent?: boolean,
      quizzesForQuizSet?: any[],
    ) => {
      console.log("Answer changed for quiz:", quizId, "Answer:", answer);
      return Promise.resolve();
    },
    showNotification: (message: string, type: "success" | "error") => {
      console.log(`Notification: ${message} (${type})`);
    },
    currentQuizSetId: "test-set-1",
    loadingOperation: null,
    setSelectedQuizIndex: (index: number | null) => {
      console.log("Selected quiz index:", index);
    },
    isTestMode: false,
  },
};

export const WithQuizzes: Story = {
  args: {
    ...Default.args,
  },
  render: (args) => {
    const quizTabsRef = React.useRef<any>(null);

    React.useEffect(() => {
      // Add mock quizzes to the first tab after component mounts
      setTimeout(() => {
        if (quizTabsRef.current) {
          quizTabsRef.current.addQuizToPage(mockQuizzes);
        }
      }, 100);
    }, []);

    return <QuizTabs ref={quizTabsRef} {...args} />;
  },
};

export const MultipleTabs: Story = {
  args: {
    ...Default.args,
  },
  render: (args) => {
    const quizTabsRef = React.useRef<any>(null);

    React.useEffect(() => {
      // Add mock quizzes to tabs after component mounts
      setTimeout(() => {
        if (quizTabsRef.current) {
          // Add quizzes to first tab
          quizTabsRef.current.addQuizToPage([mockQuizzes[0]]);

          // Add a delay then add quizzes to second tab
          setTimeout(() => {
            // Simulate clicking the add tab button
            const addButton = document.querySelector(
              '[data-testid="add-tab-button"]',
            );
            if (addButton) {
              (addButton as HTMLButtonElement).click();

              // Add second quiz to the new tab
              setTimeout(() => {
                quizTabsRef.current?.addQuizToPage([mockQuizzes[1]]);
              }, 100);
            }
          }, 500);
        }
      }, 100);
    }, []);

    return <QuizTabs ref={quizTabsRef} {...args} />;
  },
};

export const LoadingState: Story = {
  args: {
    ...Default.args,
    loadingOperation: "Loading quizzes...",
  },
};

export const RenderedQuizPages: Story = {
  args: {
    ...Default.args,
  },
  render: (args) => {
    const quizTabsRef = React.useRef<any>(null);

    // Mock data for quizzes with different states
    const quizzesWithStates = [
      {
        _id: "1",
        type: "A1" as const,
        class: "Biology",
        unit: "Cell Biology",
        tags: ["mitosis", "cell division"],
        question: "What is the correct order of mitosis phases?",
        options: [
          { oid: "A", text: "Prophase, Metaphase, Anaphase, Telophase" },
          { oid: "B", text: "Metaphase, Prophase, Anaphase, Telophase" },
          { oid: "C", text: "Anaphase, Telophase, Prophase, Metaphase" },
          { oid: "D", text: "Telophase, Anaphase, Metaphase, Prophase" },
        ],
        answer: "A",
        analysis: {
          point: "Mitosis is the process of cell division",
          discuss: "The correct order is important for proper cell division",
          ai_analysis: "Understanding mitosis is fundamental to cell biology",
          link: [],
        },
        source: "Biology Textbook Chapter 5",
        userAnswer: "A", // Correct answer
      },
      {
        _id: "2",
        type: "A2" as const,
        class: "Biology",
        unit: "Genetics",
        tags: ["dna", "replication"],
        question:
          "Which enzyme is responsible for unwinding the DNA double helix during replication?",
        options: [
          { oid: "A", text: "DNA polymerase" },
          { oid: "B", text: "Helicase" },
          { oid: "C", text: "Ligase" },
          { oid: "D", text: "Primase" },
        ],
        answer: "B",
        analysis: {
          point: "DNA replication requires several enzymes",
          discuss: "Helicase breaks hydrogen bonds between base pairs",
          ai_analysis: "Enzyme functions are crucial for DNA replication",
          link: [],
        },
        source: "Biology Textbook Chapter 7",
        userAnswer: "C", // Incorrect answer
      },
      {
        _id: "3",
        type: "A1" as const,
        class: "Chemistry",
        unit: "Periodic Table",
        tags: ["elements", "groups"],
        question: "Which group of elements are known as noble gases?",
        options: [
          { oid: "A", text: "Group 1" },
          { oid: "B", text: "Group 14" },
          { oid: "C", text: "Group 18" },
          { oid: "D", text: "Group 2" },
        ],
        answer: "C",
        analysis: {
          point: "Noble gases have complete electron shells",
          discuss: "Group 18 elements are chemically inert",
          ai_analysis:
            "Understanding periodic table groups is fundamental to chemistry",
          link: [],
        },
        source: "Chemistry Textbook Chapter 3",
        // No userAnswer - unanswered quiz
      },
    ];

    React.useEffect(() => {
      // Add quizzes with different states to the first tab after component mounts
      setTimeout(() => {
        if (quizTabsRef.current) {
          quizTabsRef.current.addQuizToPage(quizzesWithStates);
        }
      }, 100);
    }, []);

    return <QuizTabs ref={quizTabsRef} {...args} />;
  },
};
