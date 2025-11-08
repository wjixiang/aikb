import React from "react";
import { Meta, StoryObj } from "@storybook/nextjs";
import ChatInterface from "./ChatInterface";
import { SessionProvider } from "next-auth/react";

// Mock data for the component props
const mockMessages = [
  {
    id: "1",
    sender: "user",
    content: "Hello, how can you help me with my studies?",
    timestamp: new Date(Date.now() - 300000),
  },
  {
    id: "2",
    sender: "ai",
    content:
      "I can help you with various subjects! I can explain concepts, answer questions, and even help you practice with quizzes. What subject are you studying today?",
    timestamp: new Date(Date.now() - 240000),
  },
  {
    id: "3",
    sender: "user",
    content: "I'm studying biology, specifically cell biology.",
    timestamp: new Date(Date.now() - 180000),
  },
  {
    id: "4",
    sender: "ai",
    content:
      "Great! Cell biology is fascinating[ref:1]. I can help explain cell structures, functions, and processes. Would you like me to explain something specific about cell biology, or do you have questions about a particular topic?",
    timestamp: new Date(Date.now() - 120000),
    sources: [
      {
        title: "Cellular Respiration - Biology LibreTexts",
        page_number: "15",
        score: 0.95,
        content:
          "Cellular respiration is the process of converting glucose into ATP through glycolysis, the Krebs cycle, and the electron transport chain.",
        presigned_url: "https://example.com/cellular-respiration.pdf",
      },
      {
        title: "Mitochondrial Function in Cells",
        page_number: "22",
        score: 0.87,
        content:
          "The mitochondria are the powerhouse of the cell, responsible for ATP production through oxidative phosphorylation.",
        presigned_url: "https://example.com/mitochondria.pdf",
      },
    ],
  },
];

const mockStatusMessages = [
  "Searching knowledge base...",
  "Generating response...",
];

const mockCurrentAiMessage = {
  content:
    "Based on what you've told me, I think understanding the organelles and their functions would be a good starting point.",
  isComplete: false,
};

const meta: Meta<typeof ChatInterface> = {
  title: "AI Coach/ChatInterface",
  component: ChatInterface,
  parameters: {
    layout: "fullscreen",
  },
  decorators: [
    (Story) => {
      // Provide a basic div with id '__next' to simulate Next.js root element
      return (
        <SessionProvider
          session={{ expires: "1", user: { email: "test@example.com" } }}
        >
          <div id="__next">
            <div className="h-screen">
              <Story />
            </div>
          </div>
        </SessionProvider>
      );
    },
  ],
};

export default meta;

type Story = StoryObj<typeof ChatInterface>;

export const Default: Story = {
  args: {
    messages: mockMessages,
    statusMessages: mockStatusMessages,
    currentAiMessage: mockCurrentAiMessage,
    loading: false,
    selectedSource: "",
    hasSelectedQuiz: false,
    onSendMessage: async (message: string) => {
      console.log("Sending message:", message);
      return Promise.resolve();
    },
    onRegenerateLastMessage: (source: string) => {
      console.log("Regenerating last message with source:", source);
    },
    onCancelRequest: () => {
      console.log("Cancel request");
    },
    onClearChat: () => {
      console.log("Clear chat");
    },
    cotMessages: [],
    speechQueue: [],
    isSpeaking: false,
    showCoT: false,
    quizContentForInput: null,
    onMessagesUpdate: (messages: any[]) => {
      console.log("Messages updated:", messages);
    },
  },
};

export const Loading: Story = {
  args: {
    ...Default.args,
    loading: true,
    currentAiMessage: {
      content: "I'm thinking about your question...",
      isComplete: false,
    },
  },
};

export const WithChainOfThought: Story = {
  args: {
    ...Default.args,
    showCoT: true,
    cotMessages: [
      "Step 1: Understanding the question about cell biology",
      "Step 2: Retrieving relevant information from knowledge base",
      "Step 3: Formulating a comprehensive response",
    ],
  },
};

export const WithSelectedQuiz: Story = {
  args: {
    ...Default.args,
    hasSelectedQuiz: true,
    quizContentForInput: "What is the function of mitochondria in a cell?",
  },
};

export const StreamingResponse: Story = {
  args: {
    ...Default.args,
    messages: [
      ...mockMessages,
      {
        id: "5",
        sender: "user",
        content:
          "Can you explain the process of cellular respiration in detail?",
        timestamp: new Date(Date.now() - 60000),
      },
    ],
    loading: true,
    currentAiMessage: {
      content: "",
      isComplete: false,
    },
    statusMessages: [
      "Searching knowledge base...",
      "Generating detailed response...",
    ],
    onSendMessage: async (message: string) => {
      console.log("Sending message:", message);
      return Promise.resolve();
    },
  },
  decorators: [
    (Story, { args }) => {
      // Simulate streaming response in Storybook
      const [currentAiMessage, setCurrentAiMessage] = React.useState(
        args.currentAiMessage,
      );
      const [loading, setLoading] = React.useState(args.loading);

      React.useEffect(() => {
        if (!loading) return;

        // Simulate streaming response
        const responseText =
          "Cellular respiration is a fascinating process that occurs in cells to convert biochemical energy from nutrients into adenosine triphosphate (ATP), and then release waste products. Let me break this down into steps:\n\n1. **Glycolysis**: This occurs in the cytoplasm where glucose is broken down into two pyruvate molecules, producing a net gain of 2 ATP and 2 NADH.\n\n2. **Pyruvate Oxidation**: Pyruvate is transported into the mitochondrial matrix where it's converted to acetyl-CoA.\n\n3. **Krebs Cycle (Citric Acid Cycle)**: This takes place in the mitochondrial matrix where acetyl-CoA is further broken down, producing CO2, more NADH, FADH2, and a small amount of ATP.\n\n4. **Electron Transport Chain**: Located in the inner mitochondrial membrane, this is where the majority of ATP is produced through oxidative phosphorylation.\n\nThe overall equation is: C6H12O6 + 6O2 → 6CO2 + 6H2O + ATP";

        let currentIndex = 0;
        const interval = setInterval(() => {
          if (currentIndex <= responseText.length) {
            const currentContent = responseText.slice(0, currentIndex);
            setCurrentAiMessage({
              content: currentContent,
              isComplete: currentIndex >= responseText.length,
            });
            currentIndex += 3; // Add 3 characters at a time for demonstration
          } else {
            clearInterval(interval);
            setLoading(false);
          }
        }, 50); // Update every 50ms for a smooth streaming effect

        return () => clearInterval(interval);
      }, [loading]);

      const updatedArgs = {
        ...args,
        currentAiMessage,
        loading,
      };

      return (
        <SessionProvider
          session={{ expires: "1", user: { email: "test@example.com" } }}
        >
          <div id="__next">
            <div className="h-screen">
              <Story args={updatedArgs} />
            </div>
          </div>
        </SessionProvider>
      );
    },
  ],
};
export const StreamingResponseWithReferences: Story = {
  args: {
    ...Default.args,
    messages: [
      ...mockMessages,
      {
        id: "5",
        sender: "user",
        content:
          "Can you explain the process of cellular respiration and provide references?",
        timestamp: new Date(Date.now() - 60000),
      },
    ],
    loading: true,
    currentAiMessage: {
      content: "",
      isComplete: false,
      sources: [
        {
          title: "Cellular Respiration - Biology LibreTexts",
          page_number: "15",
          score: 0.95,
          content:
            "Cellular respiration is the process of converting glucose into ATP through glycolysis, the Krebs cycle, and the electron transport chain.",
          presigned_url: "https://example.com/cellular-respiration.pdf",
        },
        {
          title: "Mitochondrial Function in Cells",
          page_number: "22",
          score: 0.87,
          content:
            "The mitochondria are the powerhouse of the cell, responsible for ATP production through oxidative phosphorylation.",
          presigned_url: "https://example.com/mitochondria.pdf",
        },
      ],
    },
    statusMessages: [
      "Searching knowledge base...",
      "Generating detailed response with references...",
    ],
    onSendMessage: async (message: string) => {
      console.log("Sending message:", message);
      return Promise.resolve();
    },
  },
  decorators: [
    (Story, { args }) => {
      // Simulate streaming response with references in Storybook
      const [currentAiMessage, setCurrentAiMessage] = React.useState(
        args.currentAiMessage,
      );
      const [loading, setLoading] = React.useState(args.loading);

      React.useEffect(() => {
        if (!loading) return;

        // Simulate streaming response with reference markers
        const responseText =
          "Cellular respiration is a fascinating process that occurs in cells to convert biochemical energy from nutrients into adenosine triphosphate (ATP), and then release waste products [ref:1]. Let me break this down into steps:\n\n1. **Glycolysis**: This occurs in the cytoplasm where glucose is broken down into two pyruvate molecules, producing a net gain of 2 ATP and 2 NADH.\n\n2. **Pyruvate Oxidation**: Pyruvate is transported into the mitochondrial matrix where it's converted to acetyl-CoA [ref:2].\n\n3. **Krebs Cycle (Citric Acid Cycle)**: This takes place in the mitochondrial matrix where acetyl-CoA is further broken down, producing CO2, more NADH, FADH2, and a small amount of ATP.\n\n4. **Electron Transport Chain**: Located in the inner mitochondrial membrane, this is where the majority of ATP is produced through oxidative phosphorylation [ref:1].\n\nThe overall equation is: C6H12O6 + 6O2 → 6CO2 + 6H2O + ATP";

        let currentIndex = 0;
        const interval = setInterval(() => {
          if (currentIndex <= responseText.length) {
            const currentContent = responseText.slice(0, currentIndex);
            setCurrentAiMessage({
              ...args.currentAiMessage,
              content: currentContent,
              isComplete: currentIndex >= responseText.length,
            });
            currentIndex += 3; // Add 3 characters at a time for demonstration
          } else {
            clearInterval(interval);
            setLoading(false);
          }
        }, 50); // Update every 50ms for a smooth streaming effect

        return () => clearInterval(interval);
      }, [loading]);

      const updatedArgs = {
        ...args,
        currentAiMessage,
        loading,
      };

      return (
        <SessionProvider
          session={{ expires: "1", user: { email: "test@example.com" } }}
        >
          <div id="__next">
            <div className="h-screen">
              <Story args={updatedArgs} />
            </div>
          </div>
        </SessionProvider>
      );
    },
  ],
};
export const CompletedResponseWithReferences: Story = {
  args: {
    ...Default.args,
    messages: [
      ...mockMessages,
      {
        id: "5",
        sender: "user",
        content:
          "Can you explain the process of cellular respiration and provide references?",
        timestamp: new Date(Date.now() - 60000),
      },
    ],
    loading: false, // Not loading - response is complete
    currentAiMessage: {
      content:
        "Cellular respiration is a fascinating process that occurs in cells to convert biochemical energy from nutrients into adenosine triphosphate (ATP), and then release waste products [ref:1]. Let me break this down into steps:\n\n1. **Glycolysis**: This occurs in the cytoplasm where glucose is broken down into two pyruvate molecules, producing a net gain of 2 ATP and 2 NADH.\n\n2. **Pyruvate Oxidation**: Pyruvate is transported into the mitochondrial matrix where it's converted to acetyl-CoA [ref:2].\n\n3. **Krebs Cycle (Citric Acid Cycle)**: This takes place in the mitochondrial matrix where acetyl-CoA is further broken down, producing CO2, more NADH, FADH2, and a small amount of ATP.\n\n4. **Electron Transport Chain**: Located in the inner mitochondrial membrane, this is where the majority of ATP is produced through oxidative phosphorylation [ref:1].\n\nThe overall equation is: C6H12O6 + 6O2 → 6CO2 + 6H2O + ATP",
      isComplete: true,
      sources: [
        {
          title: "Cellular Respiration - Biology LibreTexts",
          page_number: "15",
          score: 0.95,
          content:
            "Cellular respiration is the process of converting glucose into ATP through glycolysis, the Krebs cycle, and the electron transport chain.",
          presigned_url: "https://example.com/cellular-respiration.pdf",
        },
        {
          title: "Mitochondrial Function in Cells",
          page_number: "22",
          score: 0.87,
          content:
            "The mitochondria are the powerhouse of the cell, responsible for ATP production through oxidative phosphorylation.",
          presigned_url: "https://example.com/mitochondria.pdf",
        },
      ],
    },
    statusMessages: [],
  },
};
