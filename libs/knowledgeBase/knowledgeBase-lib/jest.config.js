export default {
  displayName: 'knowledgeBase-lib',
  preset: '../../../jest.preset.js',
  coverageDirectory: '../../../coverage/libs/knowledgeBase/knowledgeBase-lib',
  transformIgnorePatterns: [
    '/workspace/node_modules/(?!uuid)'
  ],
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      useESM: true
    }]
  },
  moduleNameMapper: {
    '^uuid$': '<rootDir>/jest-uuid-mock.js'
  },
  setupFilesAfterEnv: []
};
