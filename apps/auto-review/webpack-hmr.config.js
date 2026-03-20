const nodeExternals = require('webpack-node-externals');

module.exports = {
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.js', '.json', '.ts'],
  },
  externals: [nodeExternals()],
};