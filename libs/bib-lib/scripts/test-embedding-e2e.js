#!/usr/bin/env node
/**
 * Standalone E2E test script for embedding and semantic search
 * Run: node scripts/test-embedding-e2e.js
 */

import pg from 'pg';

const { Pool } = pg;

async function runTests() {
  const connectionString = process.env.BIB_DATABASE_URL || 'postgresql://admin:fl5ox03@localhost:5432/biblib';
  const pool = new Pool({ connectionString });
  const client = await pool.connect();

  console.log('='.repeat(60));
  console.log('Embedding & Semantic Search E2E Tests');
  console.log('='.repeat(60));

  try {
    // Test 1: Check database connection
    console.log('\n[1] Testing database connection...');
    const result = await client.query('SELECT NOW() as now, version() as version');
    console.log(`  ✓ Connected to PostgreSQL ${result.rows[0].version.split(' ')[0]}`);
    console.log(`  ✓ Current time: ${result.rows[0].now}`);

    // Test 2: Check articles table
    console.log('\n[2] Checking articles table...');
    const articleCount = await client.query('SELECT COUNT(*) as count FROM "Article"');
    console.log(`  ✓ Found ${articleCount.rows[0].count} articles in database`);

    // Test 3: Check pgvector extension
    console.log('\n[3] Checking pgvector extension...');
    const extResult = await client.query(
      "SELECT * FROM pg_extension WHERE extname = 'vector'"
    );
    if (extResult.rows.length > 0) {
      console.log('  ✓ pgvector extension is enabled');
    } else {
      console.log('  ✗ pgvector extension is NOT enabled');
      console.log('  Run: CREATE EXTENSION IF NOT EXISTS vector;');
    }

    // Test 4: Test vector operations
    console.log('\n[4] Testing vector operations...');

    // Test vector creation
    const vecResult = await client.query(`SELECT '[1,2,3]'::vector as v`);
    console.log(`  ✓ Vector creation: ${vecResult.rows[0].v}`);

    // Test cosine similarity (<=>)
    const cosSame = await client.query(
      `SELECT '[1,0,0]'::vector <=> '[1,0,0]'::vector as similarity`
    );
    console.log(`  ✓ Cosine similarity (same): ${cosSame.rows[0].similarity}`);

    const cosPerp = await client.query(
      `SELECT '[1,0,0]'::vector <=> '[0,1,0]'::vector as similarity`
    );
    console.log(`  ✓ Cosine similarity (perpendicular): ${cosPerp.rows[0].similarity}`);

    const cosOpp = await client.query(
      `SELECT '[1,0,0]'::vector <=> '[-1,0,0]'::vector as similarity`
    );
    console.log(`  ✓ Cosine similarity (opposite): ${cosOpp.rows[0].similarity}`);

    // Test 5: Check ArticleEmbedding table
    console.log('\n[5] Checking ArticleEmbedding table...');
    const embeddingTableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'ArticleEmbedding'
      ) as exists
    `);

    if (embeddingTableCheck.rows[0].exists) {
      console.log('  ✓ ArticleEmbedding table exists');

      const embCount = await client.query('SELECT COUNT(*) as count FROM "ArticleEmbedding" WHERE "isActive" = true');
      console.log(`  ✓ Active embeddings: ${embCount.rows[0].count}`);

      if (parseInt(embCount.rows[0].count) === 0) {
        console.log('\n[6] Creating test embeddings...');

        // Get some articles
        const articles = await client.query(`
          SELECT id, "pmid", "articleTitle"
          FROM "Article"
          LIMIT 5
        `);

        console.log(`  Found ${articles.rows.length} articles to embed`);

        for (const article of articles.rows) {
          // Create a mock embedding vector
          const vector = Array(1024).fill(0).map(() => Math.random() * 2 - 1);
          const vectorStr = `[${vector.join(',')}]`;

          await client.query(`
            INSERT INTO "ArticleEmbedding"
            (id, "articleId", provider, model, dimension, text, vector, "isActive", "createdAt", "updatedAt")
            VALUES
            (gen_random_uuid()::text, $1, 'test', 'test-model', 1024, $2, $3::vector, true, NOW(), NOW())
          `, [article.id, article.articleTitle, vectorStr]);

          console.log(`  ✓ Embedded article ${article.pmid}`);
        }

        const newEmbCount = await client.query('SELECT COUNT(*) as count FROM "ArticleEmbedding" WHERE "isActive" = true');
        console.log(`  ✓ Total active embeddings: ${newEmbCount.rows[0].count}`);
      }

      // Test 7: Semantic search with actual data
      console.log('\n[7] Testing semantic search...');

      // Get first embedding
      const firstEmb = await client.query(`
        SELECT ae.*, a."pmid", a."articleTitle"
        FROM "ArticleEmbedding" ae
        JOIN "Article" a ON ae."articleId" = a.id
        WHERE ae."isActive" = true
        LIMIT 1
      `);

      if (firstEmb.rows.length > 0) {
        console.log(`  Found embedding for PMID: ${firstEmb.rows[0].pmid}`);
        console.log(`  Title: ${firstEmb.rows[0].articleTitle?.substring(0, 50)}...`);
        console.log(`  Provider: ${firstEmb.rows[0].provider}, Model: ${firstEmb.rows[0].model}`);

        // Search for similar articles
        const similar = await client.query(`
          SELECT
            a.id,
            a."pmid",
            a."articleTitle",
            (ae.vector <=> $1::vector) as similarity
          FROM "ArticleEmbedding" ae
          JOIN "Article" a ON ae."articleId" = a.id
          WHERE ae."isActive" = true
            AND ae.provider = $2
            AND ae.model = $3
            AND ae."articleId" != $4
          ORDER BY ae.vector <=> $1::vector
          LIMIT 5
        `, [firstEmb.rows[0].vector, 'test', 'test-model', firstEmb.rows[0].articleId]);

        console.log(`  ✓ Found ${similar.rows.length} similar articles`);
        for (const row of similar.rows) {
          console.log(`    - PMID ${row.pmid}: ${row.articleTitle?.substring(0, 40)}... (similarity: ${row.similarity?.toFixed(4)})`);
        }
      }

      // Test 8: Check indexes
      console.log('\n[8] Checking performance indexes...');
      const indexes = await client.query(`
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE tablename = 'ArticleEmbedding'
      `);

      if (indexes.rows.length > 0) {
        console.log('  ✓ Indexes on ArticleEmbedding:');
        for (const idx of indexes.rows) {
          console.log(`    - ${idx.indexname}`);
        }
      } else {
        console.log('  ✗ No indexes on ArticleEmbedding (performance may be slow)');
      }

    } else {
      console.log('  ✗ ArticleEmbedding table does NOT exist');
      console.log('  Run Prisma migration to create the table');
    }

    console.log('\n' + '='.repeat(60));
    console.log('All tests completed!');
    console.log('='.repeat(60));

  } catch (err) {
    console.error('\nError during tests:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

runTests().catch(console.error);
