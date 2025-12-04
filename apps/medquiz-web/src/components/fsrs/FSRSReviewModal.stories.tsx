import type { Meta, StoryObj } from '@storybook/nextjs';

import FsrsReviewModal from './FSRSReviewModal';

const meta = {
  component: FsrsReviewModal,
} satisfies Meta<typeof FsrsReviewModal>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    open: true,
    onOpenChange: () => {},
  },
};
