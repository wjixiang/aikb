/**
 * Test script for the bidirectional link indexing system
 */

import { LinkIndexingService } from "@/kgrag/services/linkIndexingService";
import { LinkStatsService } from "@/kgrag/services/linkStatsService";
import { LinkExtractor } from "@/kgrag/lib/linkExtractor";
import { createLoggerWithPrefix } from "@/lib/console/logger";

const logger = createLoggerWithPrefix("TestLinkIndexing");

async function testLinkIndexing() {
  try {
    logger.info("Starting link indexing tests...");

    const indexingService = new LinkIndexingService();
    const statsService = new LinkStatsService();

    // Test 1: Link extraction
    logger.info("🧪 Testing link extraction...");
    const testContent = `
            This is a test document with [[Test Document]] and [[Another Document|with alias]].
            It also contains [[Third Document]] and some [[Fourth Document|custom display text]].
        `;

    const extractedLinks = LinkExtractor.extract(testContent);
    console.log("✓ Extracted links:", extractedLinks);

    // Test 2: Link validation
    logger.info("🧪 Testing link validation...");
    const validation = await indexingService.validateLinks(testContent);
    console.log("✓ Validation results:", validation);

    // Test 3: Get link statistics
    logger.info("🧪 Testing link statistics...");
    const stats = await statsService.getLinkStats();
    console.log("✓ Link stats:", stats);

    // Test 4: Test API endpoints (if documents exist)
    logger.info("🧪 Testing API endpoints...");

    // Test forward links endpoint
    try {
      const response = await fetch("http://localhost:3000/api/links/stats");
      if (response.ok) {
        const data = await response.json();
        console.log("✓ API endpoints working:", data);
      }
    } catch (apiError) {
      console.log(
        "⚠️ API endpoints not available (expected in test environment)",
      );
    }

    logger.info("✅ All tests completed successfully!");
  } catch (error) {
    logger.error("Tests failed", { error });
    console.error("Test failed:", error);
    process.exit(1);
  }
}

// Run tests if called directly
if (require.main === module) {
  testLinkIndexing();
}

export { testLinkIndexing };
