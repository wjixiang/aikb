const fs = require('fs');
const path = require('path');

const outputPath = path.join(__dirname, '../../../dist/apps/bibliography-service');
const packageJsonPath = path.join(outputPath, 'package.json');

// Read the existing package.json, or create a default one if it doesn't exist
let packageJson = {};
if (fs.existsSync(packageJsonPath)) {
  packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
} else {
  packageJson = {
    "name": "bibliography-service",
    "version": "0.0.1",
    "main": "main.js",
    "dependencies": {}
  };
}

// Add workspace dependencies for libraries that need to be available at runtime
const workspaceLibs = [
  'log-management',
  '@aikb/s3-service',
  'chunking',
  'embedding',
  '@aikb/pdf-converter',
  'item-vector-storage',
  'utils',
  'library-shared',
  'bibliography',
  'bibliography-db',
  'bibliography-lib',
];

workspaceLibs.forEach(lib => {
  if (!packageJson.dependencies[lib]) {
    packageJson.dependencies[lib] = 'workspace:*';
  }
});

// Write the updated package.json
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

console.log('Updated package.json with workspace dependencies');
