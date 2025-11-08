import type { Preview } from '@storybook/nextjs'
import React from 'react';
import { AppRouterContext, AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { SearchParamsContext } from 'next/dist/shared/lib/hooks-client-context.shared-runtime';
import { SessionProvider } from 'next-auth/react';

import "../src/app/globals.css"

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
       color: /(background|color)$/i,
       date: /Date$/i,
      },
    },
  },
};

const fakeRouter: AppRouterInstance = {
  push: (url: string) => {
    console.log('push', url);
    return Promise.resolve(true);
  },
  replace: (url: string) => {
    console.log('replace', url);
    return Promise.resolve(true);
  },
  refresh: () => {
    console.log('refresh');
  },
  prefetch: async (url: string) => {
    console.log('prefetch', url);
    return;
  },
  back: () => {
    console.log('back');
  },
  forward: () => {
    console.log('forward');
  }
};

const fakeSearchParams = new URLSearchParams('q=storybook');

export const decorators = [
  (Story: React.FC) => (
    <AppRouterContext.Provider value={fakeRouter}>
      <SearchParamsContext.Provider value={fakeSearchParams}>
        <SessionProvider session={{
          user: {
            name: 'Storybook User',
            email: 'user@storybook.test',
            image: null,
          },
          expires: '2030-01-01T00:00:00Z',
        }}>
          <Story />
        </SessionProvider>
      </SearchParamsContext.Provider>
    </AppRouterContext.Provider>
  )
];

export default preview;