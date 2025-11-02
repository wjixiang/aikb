require('dotenv').config();
const path = require('path');
const { withNx } = require("@nx/next");

/**
 * @type {import('next').NextConfig}
 */
const nextConfig = {
    // Use this to set Nx-specific options
    // See: https://nx.dev/recipes/next/next-config-setup
    nx: {},
    reactStrictMode: false,
    // Enable standalone output for Docker deployment
    output: 'standalone',
    // Indicate that these packages should not be bundled by webpack
    serverExternalPackages: [
        "sharp",
        "onnxruntime-node",
        "@zilliz/milvus2-sdk-node",
        "@boundaryml/baml",
        "pg",
        "playwright-core", // Add playwright-core to serverExternalPackages
      ],
    
    webpack: (config, context) => {
      const { isServer } = context;
      
      if (isServer) {
        config.externals.push('@boundaryml/baml');
        config.externals.push('webworker-threads');
        config.externals.push('playwright-core'); // Add playwright-core to externals
      }

      // Add path aliases to webpack
      config.resolve.alias = {
        ...config.resolve.alias,
        '@': path.resolve(__dirname, 'src'),
        '@/components': path.resolve(__dirname, 'src/components'),
        '@/components/ui': path.resolve(__dirname, 'src/components/ui'),
        '@/hooks': path.resolve(__dirname, 'src/hooks'),
        '@/lib': path.resolve(__dirname, 'src/lib'),
      };

      // Handle .node files
      config.module.rules.push({
        test: /\.node$/,
        use: 'node-loader',
      });
      
      // Ignore Storybook files
      config.module.rules.push({
        test: /\.stories\.(js|jsx|mjs|ts|tsx)$/,
        use: 'ignore-loader',
      });

      
      return config;
    },
    
    // Turbopack configuration
    experimental: {
      turbo: {
        resolveAlias: {
          '@': path.resolve(__dirname, 'src'),
          '@/components': path.resolve(__dirname, 'src/components'),
          '@/components/ui': path.resolve(__dirname, 'src/components/ui'),
          '@/hooks': path.resolve(__dirname, 'src/hooks'),
          '@/lib': path.resolve(__dirname, 'src/lib'),
        },
        rules: {
          '*.node': {
            loaders: ['node-loader'],
          },
        },
      },
    },
};

// Apply withNx with the nextConfig
/** @type {import('next').NextConfig} */
const config = withNx(nextConfig);

module.exports = config;