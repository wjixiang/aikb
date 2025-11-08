import type { StorybookConfig } from '@storybook/nextjs';
import path from 'path';

const config: StorybookConfig = {
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: [
    '@chromatic-com/storybook',
    '@storybook/addon-docs',
    '@storybook/addon-onboarding',
    '@storybook/addon-a11y',
    '@storybook/addon-vitest',
    '@storybook/addon-styling-webpack',
    '@storybook/addon-themes',
  ],
  framework: {
    name: '@storybook/nextjs',
    options: {},
  },
  staticDirs: ['../public'],
  webpackFinal: async (config) => {
    if (config.resolve) {
      // Add alias for next/navigation mock
      config.resolve.alias = {
        ...config.resolve.alias,
        'next/navigation': require('path').resolve(
          __dirname,
          '__mocks__/next/navigation',
        ),
        '@/types': path.resolve(__dirname, '../src/types'),
        '@': path.resolve(__dirname, '../src'),
      };
    }
    return config;
  },
};
export default config;
