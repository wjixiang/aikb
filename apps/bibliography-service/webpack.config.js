const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
const { join } = require('path');

module.exports = {
  output: {
    path: join(__dirname, '../../dist/apps/bibliography-service'),
    clean: true,
    ...(process.env.NODE_ENV !== 'production' && {
      devtoolModuleFilenameTemplate: '[absolute-resource-path]',
    }),
  },
  resolve: {
    alias: {
      'log-management': join(__dirname, '../../dist/libs/log-management/src/index.js'),
      '@aikb/s3-service': join(__dirname, '../../dist/libs/s3-service/src/index.js'),
      'chunking': join(__dirname, '../../dist/libs/chunking/src/index.js'),
      'embedding': join(__dirname, '../../dist/libs/embedding/src/index.js'),
      '@aikb/pdf-converter': join(__dirname, '../../dist/libs/pdf-converter/src/index.js'),
      'item-vector-storage': join(__dirname, '../../dist/libs/item-vector-storage/src/index.js'),
      'utils': join(__dirname, '../../dist/libs/utils/src/index.js'),
      'library-shared': join(__dirname, '../../dist/libs/library-shared/src/index.js'),
    }
  },
  plugins: [
    new NxAppWebpackPlugin({
      target: 'node',
      compiler: 'tsc',
      main: './src/main.ts',
      tsConfig: './tsconfig.app.json',
      assets: ['./src/assets'],
      optimization: false,
      outputHashing: 'none',
      generatePackageJson: true,
      sourceMaps: true,
      outputModule: true
    }),
  ]
};
