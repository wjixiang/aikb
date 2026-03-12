#!/usr/bin/env node
/**
 * Database initialization script
 * Run this script to set up pgvector extension and performance indexes
 *
 * Usage: node scripts/init-db.js
 */

import pg from 'pg';

const { Pool } = pg;

async function initDatabase() {
  const connectionString = process.env.BIB_DATABASE_URL || 'postgresql://admin:fl5ox03@localhost:5432/biblib';
  const pool = new Pool({ connectionString });

  const client = await pool.connect();

  try {
    console.log('Initializing database...');

    // Enable pgvector extension
    await client.query(`
      CREATE EXTENSION IF NOT EXISTS vector;
    `);
    console.log('✓ pgvector extension enabled');

    // Create GIN indexes for full-text search
    await client.query(`
      CREATE INDEX IF NOT EXISTS "Article_articleTitle_gin_idx" ON "Article" USING gin ("articleTitle" gin_trgm_ops);
    `);
    console.log('✓ GIN index on Article.title');

    await client.query(`
      CREATE INDEX IF NOT EXISTS "Journal_title_gin_idx" ON "Journal" USING gin ("title" gin_trgm_ops);
    `);
    console.log('✓ GIN index on Journal.title');

    await client.query(`
      CREATE INDEX IF NOT EXISTS "Author_lastName_gin_idx" ON "Author" USING gin ("lastName" gin_trgm_ops);
    `);
    console.log('✓ GIN index on Author.lastName');

    await client.query(`
      CREATE INDEX IF NOT EXISTS "MeshHeading_descriptorName_gin_idx" ON "MeshHeading" USING gin ("descriptorName" gin_trgm_ops);
    `);
    console.log('✓ GIN index on MeshHeading.descriptorName');

    // Create HNSW index for vector similarity search
    // Note: This requires the vector column to exist with proper dimension
    try {
      await client.query(`
        CREATE INDEX IF NOT EXISTS "ArticleEmbedding_vector_hnsw_cosine_idx"
        ON "ArticleEmbedding"
        USING hnsw (vector vector_cosine_ops)
        WITH (m = 16, ef_construction = 64);
      `);
      console.log('✓ HNSW index on ArticleEmbedding.vector (cosine)');
    } catch (err) {
      // Index might fail if table/column doesn't exist yet
      console.log('⚠ HNSW index skipped (table or column may not exist):', err.message);
    }

    // Test vector operations
    try {
      const result = await client.query(`
        SELECT '[1,2,3]'::vector <=> '[1,2,3]'::vector as similarity
      `);
      console.log('✓ Vector similarity operator working:', result.rows[0].similarity);
    } catch (err) {
      console.log('⚠ Vector operations test failed:', err.message);
    }

    console.log('\nDatabase initialization complete!');

  } catch (err) {
    console.error('Error initializing database:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

initDatabase()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
