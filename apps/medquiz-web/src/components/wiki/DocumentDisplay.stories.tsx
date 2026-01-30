import type { Meta, StoryObj } from '@storybook/nextjs';

import DocumentDisplay from './DocumentDisplay';

const meta = {
  component: DocumentDisplay,
} satisfies Meta<typeof DocumentDisplay>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    content: '# hello \n 1. [[link]]',
  },
};
