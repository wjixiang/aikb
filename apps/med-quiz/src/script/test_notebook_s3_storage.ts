#!/usr/bin/env ts-node
import notebook_s3_storage, {
  ImageUploadData,
} from "../kgrag/notebook_s3_storage";

async function main() {
  console.log("Testing notebook_s3_storage...");

  // Initialize storage
  const storage = new notebook_s3_storage();

  // Test connection
  console.log("Checking S3 connection...");
  const isConnected = await storage.checkConnection();
  if (!isConnected) {
    console.error("❌ Failed to connect to S3");
    process.exit(1);
  }
  console.log("✅ S3 connection successful");

  // Test data
  const testKey = "test_chunk_" + Date.now();
  // Test image upload
  const testImageChunk: ImageUploadData = {
    imageData: Buffer.from("fake-image-data"), // In real usage, this would be actual image binary data
    imageType: "image/png",
  };

  // Use image chunk for testing
  const testChunk = testImageChunk;

  try {
    // Test upload
    console.log(`Uploading test chunk with key: ${testKey}`);
    const s3Url = await storage.uploadImage(testImageChunk, testKey);
    console.log("✅ Upload successful");
    console.log("Uploaded to:", s3Url);

    // Test get
    console.log("Retrieving test chunk...");
    const retrieved = await storage.getChunk(testKey);
    console.log("✅ Get successful");
    console.log("Retrieved content:", retrieved.content);

    // Test delete
    console.log("Deleting test chunk...");
    await storage.deleteChunk(testKey);
    console.log("✅ Delete successful");

    console.log("All tests passed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Test failed:", error);
    process.exit(1);
  }
}

main().catch(console.error);
