import { migrateTagTypes } from './migrate-tag-types';

// Simple test script to verify the migration works
async function testMigration() {
  try {
    console.log('Testing tag type migration...');
    await migrateTagTypes();
    console.log('Migration test completed successfully!');
  } catch (error) {
    console.error('Migration test failed:', error);
    process.exit(1);
  }
}

// Run test if this script is executed directly
if (require.main === module) {
  testMigration()
    .then(() => {
      console.log('Test finished.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Test failed:', error);
      process.exit(1);
    });
}

export { testMigration };
