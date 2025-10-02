import { connectToDatabase } from '../lib/mongodb';

async function testDatabaseConnection() {
  console.log('Testing MongoDB connection...');
  
  try {
    const { client, db } = await connectToDatabase();
    console.log('✅ MongoDB connection successful');
    
    // Test basic operations
    const collections = await db.listCollections().toArray();
    console.log(`✅ Found ${collections.length} collections in database`);
    
    // Test a simple ping
    await db.admin().ping();
    console.log('✅ Database ping successful');
    
    // Close the connection
    await client.close();
    console.log('✅ Connection closed successfully');
    
    return true;
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
    return false;
  }
}

testDatabaseConnection().then(success => {
  if (success) {
    console.log('\n✅ All database tests passed');
  } else {
    console.log('\n❌ Database tests failed');
  }
  process.exit(success ? 0 : 1);
});