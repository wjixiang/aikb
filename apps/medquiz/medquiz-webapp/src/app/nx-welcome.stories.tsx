import type { Meta, StoryObj } from '@storybook/react-vite';
import { NxWelcome } from './nx-welcome';
import { expect } from 'storybook/test';

const meta = {
  component: NxWelcome,
  title: 'NxWelcome',
} satisfies Meta<typeof NxWelcome>;
export default meta;

type Story = StoryObj<typeof NxWelcome>;

export const Primary = {
  args: {
    title: '',
  },
} satisfies Story;

export const Heading = {
  args: {
    title: '',
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(/NxWelcome/gi)).toBeTruthy();
  },
} satisfies Story;
