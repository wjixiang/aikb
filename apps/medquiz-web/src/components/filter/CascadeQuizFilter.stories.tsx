import type { Meta, StoryObj } from '@storybook/nextjs';

import { QuizFilterColumn } from './CascadeQuizFilter';

const meta = {
  component: QuizFilterColumn,
} satisfies Meta<typeof QuizFilterColumn>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'So simple!',
  args: {
    selectorName: 'Subjects',
    value: ['Mathematics', 'Science', 'History', 'Literature'],
    onSelectedValueChange: (selectedValue: string[]) => {
      console.log('Selected values:', selectedValue);
    },
  },
};

export const EmptyFilter: Story = {
  name: 'Empty Filter',
  args: {
    selectorName: 'Categories',
    value: [],
    onSelectedValueChange: (selectedValue: string[]) => {
      console.log('Selected values:', selectedValue);
    },
  },
};

export const LongList: Story = {
  name: 'Long List',
  args: {
    selectorName: 'Topics',
    value: [
      'Algebra',
      'Geometry',
      'Calculus',
      'Trigonometry',
      'Statistics',
      'Physics',
      'Chemistry',
      'Biology',
      'Astronomy',
      'Geology',
    ],
    onSelectedValueChange: (selectedValue: string[]) => {
      console.log('Selected values:', selectedValue);
    },
  },
};
