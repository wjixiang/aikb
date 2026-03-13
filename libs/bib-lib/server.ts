/**
 * bib-lib Simple Server
 * A simple Express server using raw SQL queries
 */
import express from 'express';
import pg from 'pg';
import swaggerUi from 'swagger-ui-express';

const { Pool } = pg;

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
    const { query, provider = 'test', model = 'test-model', limit = 20 } = req.query;
    const limitNum = Math.min(Math.max(1, parseInt(limit as string) || 20), 100);

    // Check if embeddings exist
    const embCount = await pool.query(`
      SELECT COUNT(*) as count FROM "ArticleEmbedding"
      WHERE "isActive" = true AND provider = $1 AND model = $2
    `, [provider, model]);

    if (parseInt(embCount.rows[0].count) === 0) {
      return res.json({
        results: [],
        total: 0,
        message: 'No embeddings found. Please run embedding generation first.'
      });
    }

    // For now, return a message since we need to generate query embedding
    res.json({
      message: 'Semantic search requires query embedding. Use /api/search for keyword search.',
      results: [],
      total: 0
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

// 404 handler - must be after all routes
app.use((req, res) => {
  res.status(404).json({ error: 'Not found', path: req.path });
});

// Handle shutdown
process.on('SIGINT', async () => {
  await pool.end();
  process.exit(0);
});
