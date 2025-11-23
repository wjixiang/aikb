const { createGlobPatternsForDependencies } = require('@nx/react/tailwind');
const { join } = require('path');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    join(
      __dirname,
      '{src,pages,components,app}/**/*!(*.stories|*.spec).{ts,tsx,html}',
    ),
    ...createGlobPatternsForDependencies(__dirname),
    join(__dirname, '../../../libs/ui/src/**/*.{ts,tsx}'), // Manual path addition - this was crucial!
  ],
  theme: {
    extend: {}, // Add any app-specific theme extensions here
  },
  plugins: [], // Add any app-specific plugins here
};
