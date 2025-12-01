export default {
  displayName: 'knowledgeBase-lib',
  preset: '../../../jest.preset.js',
  coverageDirectory: '../../../coverage/libs/knowledgeBase/knowledgeBase-lib',
  transformIgnorePatterns: [
    '/workspace/node_modules/(?!uuid)',
    '/workspace/node_modules/(?!prisma)',
    '/workspace/node_modules/(?!@prisma)'
  ],
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      useESM: true
    }]
  },
  moduleNameMapper: {
    '^uuid$': '<rootDir>/jest-uuid-mock.js',
    '^entity-db$': '<rootDir>/mocks/entity-db.mock.js'
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js']
};
