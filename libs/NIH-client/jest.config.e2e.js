const { jestPreset } = require('../../jest.preset.js');

module.exports = {
  ...jestPreset,
  displayName: 'NIH-client',
  preset: '../../jest.preset.js',
  coverageDirectory: '../../coverage/libs/meSH-client',
  testMatch: ['**/*.e2e.spec.ts', '**/*.e2e.test.ts'],
};