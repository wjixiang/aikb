import type { Meta, StoryObj } from "@storybook/react-vite";

import { LinkBlock } from "./LinkBlock";

const meta = {
  component: LinkBlock,
} satisfies Meta<typeof LinkBlock>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    index: 1,
    linkId: "abc",
    linkName: "ABC",
    
  },
};
