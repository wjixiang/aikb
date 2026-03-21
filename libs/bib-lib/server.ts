/**
 * bib-lib Simple Server
 * A simple Express server using raw SQL queries
 */
import 'dotenv/config';
import express from 'express';
import pg from 'pg';
import swaggerUi from 'swagger-ui-express';
import { Embedding, EmbeddingProvider } from '@ai-embed/core';

const { Pool } = pg;

// Initialize embedding service
const embeddingService = new Embedding(EmbeddingProvider.ALIBABA);

// Initialize PostgreSQL connection
const connectionString = process.env.BIB_DATABASE_URL || 'postgresql://admin:fl5ox03@localhost:5432/biblib';
const pool = new Pool({ connectionString });

const app = express();
const PORT = process.env.PORT || 3000;

// Swagger configuration
const swaggerOptions = {
  swaggerDefinition: {
    openapi: '3.0.0',
    info: {
      title: 'bib-lib API',
      version: '1.0.0',
      description: 'PubMed bibliography search API with keyword, semantic, and hybrid search capabilities',
      contact: {
        name: 'API Support',
      },
    },
    servers: [
      {
        url: `http://0.0.0.0:${PORT}`,
        description: 'Development server',
      },
    ],
    tags: [
      { name: 'Search', description: 'Search endpoints' },
      { name: 'Export', description: 'Export endpoints' },
      { name: 'Health', description: 'Health check' },
    ],
  },
  apis: ['./server.ts'],
};

const swaggerDocument = {
  openapi: '3.0.0',
  info: {
    title: 'bib-lib API',
    version: '1.0.0',
    description: 'PubMed bibliography search API with keyword, semantic, and hybrid search capabilities',
  },
  servers: [{ url: `http://localhost:${PORT}` }],
  paths: {
    '/api/search': {
      get: {
        tags: ['Search'],
        summary: 'Search articles by keyword',
        parameters: [
          {
            name: 'query',
            in: 'query',
            required: true,
            description: 'Search query string',
            schema: { type: 'string', example: 'cancer treatment' },
          },
          {
            name: 'limit',
            in: 'query',
            description: 'Number of results to return',
            schema: { type: 'integer', default: 20, maximum: 100 },
          },
          {
            name: 'offset',
            in: 'query',
            description: 'Number of results to skip',
            schema: { type: 'integer', default: 0 },
          },
        ],
        responses: {
          '200': {
            description: 'Search results',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    results: { type: 'array' },
                    total: { type: 'integer' },
                    limit: { type: 'integer' },
                    offset: { type: 'integer' },
                    hasMore: { type: 'boolean' },
                    query: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/suggestions': {
      get: {
        tags: ['Search'],
        summary: 'Get search suggestions (autocomplete)',
        parameters: [
          {
            name: 'query',
            in: 'query',
            required: true,
            description: 'Query prefix for suggestions',
            schema: { type: 'string', example: 'canc' },
          },
          {
            name: 'limit',
            in: 'query',
            description: 'Maximum number of suggestions',
            schema: { type: 'integer', default: 10 },
          },
        ],
        responses: {
          '200': {
            description: 'List of suggestions',
            content: {
              'application/json': {
                schema: { type: 'array', items: { type: 'string' } },
              },
            },
          },
        },
      },
    },
    '/api/export': {
      get: {
        tags: ['Export'],
        summary: 'Export search results in various formats',
        parameters: [
          {
            name: 'query',
            in: 'query',
            required: false,
            description: 'Search query string',
            schema: { type: 'string' },
          },
          {
            name: 'format',
            in: 'query',
            description: 'Export format: json, bibtex, csv',
            schema: { type: 'string', enum: ['json', 'bibtex', 'csv'], default: 'json' },
          },
          {
            name: 'limit',
            in: 'query',
            description: 'Number of results to export',
            schema: { type: 'integer', default: 20 },
          },
        ],
        responses: {
          '200': {
            description: 'Exported data',
          },
        },
      },
    },
    '/api/health': {
      get: {
        tags: ['Health'],
        summary: 'Health check endpoint',
        responses: {
          '200': {
            description: 'Server is healthy',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string' },
                    timestamp: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/semantic-search': {
      get: {
        tags: ['Search'],
        summary: 'Semantic search using embeddings',
        description: 'Search articles using vector embeddings (requires embeddings to be generated)',
        parameters: [
          {
            name: 'query',
            in: 'query',
            required: true,
            description: 'Search query string',
            schema: { type: 'string' },
          },
          {
            name: 'provider',
            in: 'query',
            description: 'Embedding provider',
            schema: { type: 'string', default: 'test' },
          },
          {
            name: 'model',
            in: 'query',
            description: 'Embedding model',
            schema: { type: 'string', default: 'test-model' },
          },
          {
            name: 'limit',
            in: 'query',
            description: 'Number of results',
            schema: { type: 'integer', default: 20 },
          },
        ],
        responses: {
          '200': {
            description: 'Semantic search results',
          },
        },
      },
    },
  },
};

// Middleware
app.use(express.json());

// Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// JSON endpoint for OpenAPI spec
app.get('/api-spec.json', (req, res) => {
  res.json(swaggerDocument);
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'bib-lib API Server',
    version: '1.0.0',
    documentation: '/api-docs',
    spec: '/api-spec.json',
    endpoints: {
      search: '/api/search?query=...',
      suggestions: '/api/suggestions?query=...',
      export: '/api/export?query=...&format=...',
      health: '/api/health',
      semanticSearch: '/api/semantic-search?query=...',
    },
  });
});

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Health check
app.get('/api/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW() as now');
    res.json({ status: 'ok', timestamp: result.rows[0].now });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Search endpoint
app.get('/api/search', async (req, res) => {
  try {
    const { query, limit = 20, offset = 0 } = req.query;

    if (!query) {
      return res.json({ results: [], total: 0, message: 'Please provide a query parameter' });
    }

    const limitNum = Math.min(Math.max(1, parseInt(limit as string) || 20), 100);
    const offsetNum = Math.max(0, parseInt(offset as string) || 0);

    // Search using ILIKE
    const searchPattern = `%${query}%`;

    const [articlesResult, countResult] = await Promise.all([
      pool.query(`
        SELECT a.id, a.pmid, a."articleTitle", a.language, a."publicationType",
               j.title as journal_title, j."isoAbbreviation", j."pubYear"
        FROM "Article" a
        LEFT JOIN "Journal" j ON a."journalId" = j.id
        WHERE a."articleTitle" ILIKE $1
        ORDER BY a.pmid DESC
        LIMIT $2 OFFSET $3
      `, [searchPattern, limitNum, offsetNum]),
      pool.query(`
        SELECT COUNT(*) as total
        FROM "Article" a
        WHERE a."articleTitle" ILIKE $1
      `, [searchPattern]),
    ]);

    const total = parseInt(countResult.rows[0].total);

    const results = articlesResult.rows.map((row) => ({
      id: row.id,
      pmid: row.pmid,
      articleTitle: row.articleTitle,
      language: row.language,
      publicationType: row.publicationType,
      journal: row.journal_title ? {
        title: row.journal_title,
        isoAbbreviation: row.isoAbbreviation,
        pubYear: row.pubYear,
      } : undefined,
    }));

    res.json({
      results,
      total,
      limit: limitNum,
      offset: offsetNum,
      hasMore: offsetNum + results.length < total,
      query: query,
    });
  } catch (error: any) {
    console.error('Search error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Suggestions endpoint
app.get('/api/suggestions', async (req, res) => {
  try {
    const { query, limit = 10 } = req.query;

    if (!query) {
      return res.json([]);
    }

    const limitNum = parseInt(limit as string) || 10;
    const searchPattern = `%${query}%`;

    const result = await pool.query(`
      SELECT DISTINCT ON (a."articleTitle") a."articleTitle"
      FROM "Article" a
      WHERE a."articleTitle" ILIKE $1
      ORDER BY a."articleTitle", a.pmid DESC
      LIMIT $2
    `, [searchPattern, limitNum]);

    res.json(result.rows.map((r) => r.articleTitle));
  } catch (error: any) {
    console.error('Suggestions error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Export endpoint
app.get('/api/export', async (req, res) => {
  try {
    const { query, format = 'json', limit = 20 } = req.query;

    const limitNum = parseInt(limit as string) || 20;
    const searchPattern = query ? `%${query}%` : '%';

    const result = await pool.query(`
      SELECT a.pmid, a."articleTitle", a.language,
             j.title as journal_title, j."pubYear"
      FROM "Article" a
      LEFT JOIN "Journal" j ON a."journalId" = j.id
      WHERE a."articleTitle" ILIKE $1
      ORDER BY a.pmid DESC
      LIMIT $2
    `, [searchPattern, limitNum]);

    const formatType = format as string;

    if (formatType === 'json') {
      res.json(result.rows);
    } else if (formatType === 'bibtex') {
      const bibtex = result.rows.map((row, i) => {
        const key = `article${row.pmid}`;
        const authorStr = row.authors ? row.authors.join(' and ') : '';
        return `@article{${key},
  title = {${row.articleTitle}},
  author = {${authorStr}},
  journal = {${row.journal_title || ''}},
  year = {${row.pubYear || ''}}
}`;
      }).join('\n\n');
      res.type('text/plain').send(bibtex);
    } else if (formatType === 'csv') {
      const headers = 'pmid,title,authors,journal,year\n';
      const rows = result.rows.map((row) => {
        const title = (row.articleTitle || '').replace(/"/g, '""');
        const authors = (row.authors || []).join('; ');
        return `${row.pmid},"${title}","${authors}","${row.journal_title || ''}",${row.pubYear || ''}`;
      }).join('\n');
      res.type('text/csv').send(headers + rows);
    } else {
      res.json(result.rows);
    }
  } catch (error: any) {
    console.error('Export error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Semantic search endpoint (using embeddings)
app.get('/api/semantic-search', async (req, res) => {
  try {
    const { query, provider = 'alibaba', model = 'text-embedding-v4', dimension = 1024, limit = 20 } = req.query;

    if (!query) {
      return res.status(400).json({ error: 'Query parameter is required' });
    }

    const limitNum = Math.min(Math.max(1, parseInt(limit as string) || 20), 100);
    const dimensionNum = parseInt(dimension as string) || 1024;

    // Check if embeddings exist
    const embCount = await pool.query(`
      SELECT COUNT(*) as count FROM "ArticleEmbedding"
      WHERE "isActive" = true AND provider = $1 AND model = $2
    `, [provider, model]);

    if (parseInt(embCount.rows[0].count) === 0) {
      return res.json({
        results: [],
        total: 0,
        message: `No embeddings found for provider=${provider}, model=${model}. Please generate embeddings first.`
      });
    }

    // Generate query embedding using real embedding service
    const providerEnum = provider === 'openai' ? EmbeddingProvider.OPENAI :
                        provider === 'ollama' ? EmbeddingProvider.OLLAMA :
                        EmbeddingProvider.ALIBABA;

    const embedResult = await embeddingService.embed(query as string, {
      provider: providerEnum,
      model,
      dimension: dimensionNum,
    });

    if (!embedResult.success || !embedResult.embedding) {
      return res.status(500).json({
        error: 'Failed to generate query embedding',
        details: embedResult.error
      });
    }

    const queryVector = `[${embedResult.embedding.map(v => v.toFixed(10)).join(',')}]`;

    // Perform semantic search using cosine similarity
    const result = await pool.query(`
      SELECT
        a.id,
        a.pmid,
        a."articleTitle",
        a.abstract,
        a.language,
        j.title as journal_title,
        j."isoAbbreviation",
        j."pubYear",
        ae.provider,
        ae.model,
        ai.doi,
        1 - (ae.vector <=> $1::vector) as similarity
      FROM "ArticleEmbedding" ae
      JOIN "Article" a ON ae."articleId" = a.id
      LEFT JOIN "Journal" j ON a."journalId" = j.id
      LEFT JOIN "ArticleId" ai ON a.id = ai."articleId" AND ai.doi IS NOT NULL
      WHERE ae."isActive" = true
        AND ae.provider = $2
        AND ae.model = $3
      ORDER BY ae.vector <=> $1::vector
      LIMIT $4
    `, [queryVector, provider, model, limitNum]);

    const results = result.rows.map((row) => ({
      id: row.id,
      pmid: row.pmid,
      articleTitle: row.articleTitle,
      abstract: row.abstract,
      language: row.language,
      journal: row.journal_title ? {
        title: row.journal_title,
        isoAbbreviation: row.isoAbbreviation,
        pubYear: row.pubYear,
      } : undefined,
      doi: row.doi || undefined,
      similarity: parseFloat(row.similarity),
      embeddingInfo: {
        provider: row.provider,
        model: row.model,
      },
    }));

    res.json({
      results,
      total: results.length,
      limit: limitNum,
      query: query,
      mode: 'semantic',
      provider,
      model,
    });
  } catch (error: any) {
    console.error('Semantic search error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                    bib-lib Server                        ║
╠══════════════════════════════════════════════════════════════╣
║  Server running at: http://localhost:${PORT}               ║
║                                                              ║
║  API Endpoints:                                             ║
║  - GET /api/search?query=...&limit=20                       ║
║  - GET /api/suggestions?query=...&limit=10                 ║
║  - GET /api/export?query=...&format=bibtex                   ║
║  - GET /api/health                                          ║
║                                                              ║
║  Swagger Documentation:                                      ║
║  - UI: http://localhost:${PORT}/api-docs                    ║
║  - OpenAPI Spec: http://localhost:${PORT}/api-spec.json     ║
╚══════════════════════════════════════════════════════════════╝
  `);
});

// Import article endpoint
app.post('/api/articles/import', async (req, res) => {
  console.log('[Import] Starting import for:', req.body.title?.substring(0, 50));
  let client = await pool.connect();
  let clientReleased = false;
  console.log('[Import] DB connection acquired');
  try {
    const {
      title,
      abstract,
      doi,
      pmid,
      pmc,
      pii,
      authors,
      journal,
      publicationDate,
      meshHeadings,
      language = 'en',
      publicationType,
      embed = false,           // Auto-generate embedding
      embeddingProvider = 'test',
      embeddingModel = 'test-model',
      embeddingDimension = 1536,
    } = req.body;

    if (!title) {
      return res.status(400).json({ success: false, error: 'Title is required' });
    }

    console.log('[Import] Starting transaction...');
    await client.query('BEGIN');
    console.log('[Import] Transaction started');

    // Generate PMID if not provided
    const articlePmid = pmid ? BigInt(pmid) : BigInt(-(Date.now() * 10000 + Math.floor(Math.random() * 10000)));

    // Create/find journal
    let journalId = null;
    if (journal) {
      console.log('[Import] Processing journal...');
      const journalResult = await client.query(
        `SELECT id FROM "Journal" WHERE "issn" = $1 OR "isoAbbreviation" = $2 LIMIT 1`,
        [journal.issn || null, journal.isoAbbreviation || null]
      );
      if (journalResult.rows.length > 0) {
        journalId = journalResult.rows[0].id;
      } else {
        const newJournal = await client.query(
          `INSERT INTO "Journal" (id, issn, title, "isoAbbreviation", volume, issue, "pubDate", "pubYear", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
           RETURNING id`,
          [crypto.randomUUID(), journal.issn || null, journal.title || null, journal.isoAbbreviation || null,
           journal.volume || null, journal.issue || null, journal.pubDate || null, journal.pubYear || null]
        );
        journalId = newJournal.rows[0].id;
      }
    }
    console.log('[Import] Journal done, journalId:', journalId);

    // Create article
    console.log('[Import] Creating article...');
    const articleId = crypto.randomUUID();
    const articleResult = await client.query(
      `INSERT INTO "Article" (id, pmid, "articleTitle", abstract, language, "publicationType", "dateCompleted", "journalId", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
       RETURNING id, pmid`,
      [articleId, articlePmid, title, abstract || null, language, publicationType || null,
       publicationDate ? new Date(publicationDate) : null, journalId]
    );
    console.log('[Import] Article created:', articleId);

    // Create ArticleId (DOI, PMCID, etc.)
    if (doi || pmc || pii || pmid) {
      console.log('[Import] Creating ArticleId...');
      await client.query(
        `INSERT INTO "ArticleId" (id, "articleId", doi, pmc, pii, pubmed)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [crypto.randomUUID(), articleId, doi || null, pmc || null, pii || null, articlePmid]
      );
    }

    // Create authors
    if (authors && authors.length > 0) {
      console.log('[Import] Creating authors...');
      for (const author of authors) {
        if (!author.lastName) continue;
        let authorResult = await client.query(
          `SELECT id FROM "Author" WHERE "lastName" = $1 AND ("foreName" = $2 OR "foreName" IS NULL) LIMIT 1`,
          [author.lastName, author.foreName || null]
        );
        let authorId;
        if (authorResult.rows.length === 0) {
          const newAuthor = await client.query(
            `INSERT INTO "Author" (id, "lastName", "foreName", initials, "createdAt", "updatedAt")
             VALUES ($1, $2, $3, $4, NOW(), NOW()) RETURNING id`,
            [crypto.randomUUID(), author.lastName, author.foreName || null, author.initials || null]
          );
          authorId = newAuthor.rows[0].id;
        } else {
          authorId = authorResult.rows[0].id;
        }
        await client.query(
          `INSERT INTO "AuthorArticle" (id, "authorId", "articleId")
           VALUES ($1, $2, $3)
           ON CONFLICT ("authorId", "articleId") DO NOTHING`,
          [crypto.randomUUID(), authorId, articleId]
        );
      }
    }

    // Create MeSH headings
    if (meshHeadings && meshHeadings.length > 0) {
      console.log('[Import] Creating MeSH headings...');
      for (const mesh of meshHeadings) {
        await client.query(
          `INSERT INTO "MeshHeading" (id, "articleId", "descriptorName", "qualifierName", "majorTopicYN")
           VALUES ($1, $2, $3, $4, $5)`,
          [crypto.randomUUID(), articleId, mesh.descriptorName || null,
           mesh.qualifierName ? String(mesh.qualifierName) : null, mesh.majorTopicYN || false]
        );
      }
    }

    console.log('[Import] Committing transaction...');
    await client.query('COMMIT');
    console.log('[Import] Transaction committed');

    // Release DB connection BEFORE embedding API call to avoid connection pool exhaustion
    client.release();
    clientReleased = true;
    console.log('[Import] DB connection released');

    // Auto-generate embedding if requested (outside transaction, after release)
    let embedded = false;
    if (embed && abstract) {
      console.log('[Import] Starting embedding generation...');
      try {
        const textToEmbed = `${title}\n\n${abstract}`;

        // Use real embedding service
        const providerEnum = embeddingProvider === 'openai' ? EmbeddingProvider.OPENAI :
                            embeddingProvider === 'ollama' ? EmbeddingProvider.OLLAMA :
                            EmbeddingProvider.ALIBABA;

        const embedResult = await embeddingService.embed(textToEmbed, {
          provider: providerEnum,
          model: embeddingModel,
          dimension: embeddingDimension,
        });

        console.log('[Import] Embedding result:', embedResult.success ? 'SUCCESS' : 'FAILED');

        if (embedResult.success && embedResult.embedding) {
          const embeddingStr = `[${embedResult.embedding.map(v => v.toFixed(10)).join(',')}]`;

          await pool.query(
            `INSERT INTO "ArticleEmbedding" (id, "articleId", provider, model, dimension, text, vector, "isActive", "createdAt", "updatedAt")
             VALUES ($1, $2, $3, $4, $5, $6, $7::vector, $8, NOW(), NOW())
             ON CONFLICT ("articleId", "provider", "model")
             DO UPDATE SET text = EXCLUDED.text, vector = EXCLUDED.vector, "updatedAt" = NOW()`,
            [crypto.randomUUID(), articleId, embeddingProvider, embeddingModel, embeddingDimension, textToEmbed, embeddingStr, true]
          );
          embedded = true;
          console.log(`[Import] Auto-embedded article ${articleId} using ${embeddingProvider}/${embeddingModel}`);
        } else {
          console.error(`[Import] Embedding generation failed: ${embedResult.error}`);
        }
      } catch (embedError) {
        console.error('[Import] Auto-embedding failed:', embedError);
        // Continue without embedding - article was still imported successfully
      }
    }

    console.log('[Import] Sending response...');
    res.json({
      success: true,
      articleId: articleResult.rows[0].id,
      pmid: articleResult.rows[0].pmid.toString(),
      doi: doi || null,
      embedded,
    });
  } catch (error: any) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Import error:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    // Only release if not already released
    if (!clientReleased) {
      client.release();
    }
  }
});

// Generate embedding for an article
app.post('/api/articles/:id/embed', async (req, res) => {
  try {
    const { id } = req.params;
    const { provider = 'alibaba', model = 'text-embedding-v4', dimension = 1024 } = req.body;

    // Get article
    const articleResult = await pool.query(
      `SELECT id, "articleTitle", abstract FROM "Article" WHERE id = $1`,
      [id]
    );

    if (articleResult.rows.length === 0) {
      return res.status(404).json({ error: 'Article not found' });
    }

    const article = articleResult.rows[0];
    const textToEmbed = article.abstract
      ? `${article.articleTitle}\n\n${article.abstract}`
      : article.articleTitle;

    // Use real embedding service
    const providerEnum = provider === 'openai' ? EmbeddingProvider.OPENAI :
                        provider === 'ollama' ? EmbeddingProvider.OLLAMA :
                        EmbeddingProvider.ALIBABA;

    console.log(`Generating embedding for article ${id} using ${provider}/${model}`);
    console.log(`ALIBABA_API_KEY is set:`, !!process.env.ALIBABA_API_KEY);
    console.log(`Text to embed length:`, textToEmbed.length);

    const embedResult = await embeddingService.embed(textToEmbed, {
      provider: providerEnum,
      model,
      dimension,
    });

    console.log(`Embed result:`, embedResult.success ? 'SUCCESS' : 'FAILED', embedResult.error);

    if (!embedResult.success || !embedResult.embedding) {
      return res.status(500).json({
        success: false,
        error: embedResult.error || 'Embedding generation failed'
      });
    }

    const embeddingStr = `[${embedResult.embedding.map(v => v.toFixed(10)).join(',')}]`;

    await pool.query(
      `INSERT INTO "ArticleEmbedding" (id, "articleId", provider, model, dimension, text, vector, "isActive", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7::vector, $8, NOW(), NOW())
       ON CONFLICT ("articleId", "provider", "model")
       DO UPDATE SET text = EXCLUDED.text, vector = EXCLUDED.vector, "updatedAt" = NOW()`,
      [crypto.randomUUID(), id, provider, model, dimension, textToEmbed, embeddingStr, true]
    );

    res.json({ success: true, embedded: true, provider, model, dimension });
  } catch (error: any) {
    console.error('Embedding error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 404 handler - must be after all routes
app.use((req, res) => {
  res.status(404).json({ error: 'Not found', path: req.path });
});

// Handle shutdown
process.on('SIGINT', async () => {
  await pool.end();
  process.exit(0);
});
