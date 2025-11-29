export default {
  displayName: 'knowledgeBase-lib-e2e',
  preset: '../../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
      },
    ],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/knowledgeBase-lib-e2e',
  testMatch: ['**/*.e2e.spec.ts', '**/*.e2e.test.ts'],
};