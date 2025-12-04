import React from 'react';
import { SessionProvider } from 'next-auth/react';
import { QuizFilterDrawer } from './QuizFilterDrawer';

export default {
  title: 'Components/AI-Coach/QuizApp/QuizFilterDrawer',
  component: QuizFilterDrawer,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  decorators: [
    (Story: any) => (
      <div style={{ height: '100vh', background: '#f5f5f5' }}>
        <Story />
      </div>
    ),
  ],
};

const Template = (args: any) => <QuizFilterDrawer {...args} />;

export const Default = Template.bind({});
Default.args = {
  filterDrawerOpen: true,
  loadingOperation: null,
  setFilterDrawerOpen: () => console.log('setFilterDrawerOpen called'),
  addQuizToPage: (quizzes: any[]) =>
    console.log('addQuizToPage called with:', quizzes),
  setLoadingOperation: (operation: string | null) =>
    console.log('setLoadingOperation called with:', operation),
};

export const Closed = Template.bind({});
Closed.args = {
  filterDrawerOpen: false,
  loadingOperation: null,
  setFilterDrawerOpen: () => console.log('setFilterDrawerOpen called'),
  addQuizToPage: (quizzes: any[]) =>
    console.log('addQuizToPage called with:', quizzes),
  setLoadingOperation: (operation: string | null) =>
    console.log('setLoadingOperation called with:', operation),
};

export const Loading = Template.bind({});
Loading.args = {
  filterDrawerOpen: true,
  loadingOperation: 'filter',
  setFilterDrawerOpen: () => console.log('setFilterDrawerOpen called'),
  addQuizToPage: (quizzes: any[]) =>
    console.log('addQuizToPage called with:', quizzes),
  setLoadingOperation: (operation: string | null) =>
    console.log('setLoadingOperation called with:', operation),
};

export const Interactive = Template.bind({});
Interactive.args = {
  filterDrawerOpen: true,
  loadingOperation: null,
  setFilterDrawerOpen: () => console.log('setFilterDrawerOpen called'),
  addQuizToPage: (quizzes: any[]) =>
    console.log('addQuizToPage called with:', quizzes),
  setLoadingOperation: (operation: string | null) =>
    console.log('setLoadingOperation called with:', operation),
};
Interactive.parameters = {
  docs: {
    description: {
      story:
        'Interactive story where you can toggle the drawer and see the loading states',
    },
  },
};
