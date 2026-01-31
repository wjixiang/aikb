#!/usr/bin/env tsx

/**
 * CLI script to test the example usage of Agent
 */

import { runExample } from '../lib/agents/exampleUsage';

async function main() {
  console.log('Running Agent example usage test...\n');

  try {
    await runExample();
    console.log('\nTest completed successfully.');
  } catch (error) {
    console.error('Error running test:', error);
    process.exit(1);
  }
}

// Allow passing arguments if needed in the future
if (require.main === module) {
  main().catch(console.error);
}
