/**
 * Medical Review Generation Script
 *
 * Generates narrative review articles from Excel literature data using:
 * 1. bib-lib semantic search server for literature retrieval
 * 2. BAML for structured LLM output
 */

import * as fs from 'fs';
import * as path from 'path';
import { readXlsxFile } from './quick-review.js';
import { config } from 'dotenv'
config()
import { b } from '../baml_client/index.js';


// ============ Types ============

export interface LiteratureRow {
  year: number;
  title: string;
  abstract: string;
  doi: string;
}

export interface ReviewOptions {
  excelPath: string;
  topic: string;
  sections?: string[];
  outputPath?: string;
  biblibUrl?: string;
  embeddingProvider?: string;
  embeddingModel?: string;
  batchSize?: number;
  maxArticles?: number;
  skipImport?: boolean;  // Skip import step, use existing data
  onProgress?: (message: string) => void;
}

export interface ReviewResult {
  title: string;
  abstract: string;
  keywords: string[];
  sections: Array<{
    title: string;
    content: string;
    keyFindings: string[];
  }>;
  conclusions: string;
  futureDirections?: string;
  references: Array<{
    doi: string;
    title: string;
    year?: number;
    authors?: string;
    journal?: string;
  }>;
  metadata: {
    totalArticles: number;
    importedArticles: number;
    generatedAt: string;
  };
}

// ============ Constants ============

const DEFAULT_BIBLIB_URL = 'http://localhost:3000';
const DEFAULT_EMBEDDING_PROVIDER = 'alibaba';
const DEFAULT_EMBEDDING_MODEL = 'text-embedding-v4';
const DEFAULT_BATCH_SIZE = 10;
const DEFAULT_MAX_ARTICLES = 10000; // 0 means no limit

// Default review sections for medical reviews
const DEFAULT_SECTIONS = [
  'Introduction',
  'Epidemiology',
  'Pathophysiology',
  'Diagnosis',
  'Treatment',
  'Prognosis',
  'Conclusions',
];

// Section focus descriptions
const SECTION_FOCUSES: Record<string, string> = {
  Introduction:
    'Overview of the condition, clinical significance, and scope of the review',
  Epidemiology:
    'Prevalence, incidence, risk factors, and demographic patterns',
  Pathophysiology:
    'Biological mechanisms, disease progression, and molecular pathways',
  Diagnosis:
    'Clinical examination, imaging modalities, diagnostic criteria, and differential diagnosis',
  Treatment:
    'Conservative management, surgical interventions, pharmacological treatments, and emerging therapies',
  Prognosis:
    'Outcomes, complications, recurrence rates, and prognostic factors',
  Conclusions:
    'Summary of key findings, clinical implications, and future directions',
};

// ============ Core Functions ============

/**
 * Read literature data from Excel file
 */
export async function readLiteratureExcel(
  filePath: string,
  maxRows?: number,
): Promise<LiteratureRow[]> {
  // Read raw data (no header row in this Excel)
  const XLSX = await import('xlsx');
  const xlsx = XLSX.default || XLSX;
  const workbook = xlsx.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawData = xlsx.utils.sheet_to_json<(string | number)[]>(sheet, {
    header: 1,
  });

  const rows: LiteratureRow[] = [];
  const limit = maxRows || rawData.length;

  for (let i = 0; i < Math.min(limit, rawData.length); i++) {
    const row = rawData[i];
    if (!row || row.length < 3) continue;

    const [year, title, abstract, doi] = row;
    if (!title || !abstract) continue;

    rows.push({
      year: Number(year) || new Date().getFullYear(),
      title: String(title).trim(),
      abstract: String(abstract).trim(),
      doi: doi ? String(doi).trim() : '',
    });
  }

  return rows;
}

/**
 * Import a single article to bib-lib server
 */
export async function importArticleToBibLib(
  article: LiteratureRow,
  biblibUrl: string,
  embeddingProvider: string,
  embeddingModel: string,
): Promise<{ success: boolean; articleId?: string; error?: string; title?: string }> {
  try {
    const response = await fetch(`${biblibUrl}/api/articles/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: article.title,
        abstract: article.abstract,
        doi: article.doi || undefined,
        publicationDate: article.year ? `${article.year}-01-01` : undefined,
        embed: true,  // Disable during import for speed
        embeddingProvider,
        embeddingModel,
        embeddingDimension: 1024,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error: `HTTP ${response.status}: ${error}`, title: article.title };
    }

    const result = (await response.json()) as {
      success: boolean;
      articleId?: string;
      embedded?: boolean;
    };
    return { success: true, articleId: result.articleId, title: article.title };
  } catch (error) {
    return { success: false, error: String(error), title: article.title };
  }
}

/**
 * Import all articles to bib-lib with progress tracking
 */
export async function importAllArticles(
  articles: LiteratureRow[],
  options: {
    biblibUrl: string;
    embeddingProvider: string;
    embeddingModel: string;
    batchSize: number;
    onProgress?: (message: string) => void;
  },
): Promise<{ imported: number; failed: number; articleIds: string[] }> {
  const { biblibUrl, embeddingProvider, embeddingModel, batchSize, onProgress } =
    options;
  let imported = 0;
  let failed = 0;
  const articleIds: string[] = [];

  onProgress?.(`Starting import of ${articles.length} articles (batch size: ${batchSize})...`);

  for (let i = 0; i < articles.length; i += batchSize) {
    const batchNum = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(articles.length / batchSize);
    onProgress?.(`Processing batch ${batchNum}/${totalBatches} (articles ${i + 1}-${Math.min(i + batchSize, articles.length)})...`);

    const batch = articles.slice(i, i + batchSize);

    const results = await Promise.all(
      batch.map((article) =>
        importArticleToBibLib(
          article,
          biblibUrl,
          embeddingProvider,
          embeddingModel,
        ),
      ),
    );

    for (const result of results) {
      if (result.success && result.articleId) {
        imported++;
        articleIds.push(result.articleId);
        onProgress?.(`  ✓ [${imported}/${articles.length}] Imported: ${result.title?.substring(0, 60)}...`);
      } else {
        failed++;
        onProgress?.(`  ✗ [${imported + failed}/${articles.length}] Failed: ${result.title?.substring(0, 40)}... - ${result.error}`);
      }
    }

    // Small delay between batches
    if (i + batchSize < articles.length) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  onProgress?.(`Import complete: ${imported} success, ${failed} failed`);
  return { imported, failed, articleIds };
}

/**
 * Search for relevant literature using semantic search
 */
export async function searchRelevantLiterature(
  query: string,
  options: {
    biblibUrl: string;
    provider: string;
    model: string;
    limit: number;
  },
): Promise<
  Array<{
    id: string;
    title: string;
    abstract: string;
    similarity: number;
    doi?: string;
  }>
> {
  const { biblibUrl, provider, model, limit } = options;

  const params = new URLSearchParams({
    query,
    provider,
    model,
    limit: String(limit),
  });

  const response = await fetch(
    `${biblibUrl}/api/semantic-search?${params.toString()}`,
  );

  if (!response.ok) {
    throw new Error(`Semantic search failed: ${response.status}`);
  }

  const result = (await response.json()) as {
    results: Array<{
      id: string;
      articleTitle: string;
      abstract: string;
      similarity: number;
      doi?: string;
    }>;
    total: number;
  };

  return result.results.map((r) => ({
    id: r.id,
    title: r.articleTitle,
    abstract: r.abstract,
    similarity: r.similarity,
    doi: r.doi,
  }));
}

/**
 * Format literature for BAML input - only articles with DOI
 * Uses DOI as the citation identifier instead of numeric index
 * Returns both the formatted string and the list of valid DOIs for validation
 */
function formatLiteratureForBaml(
  articles: Array<{
    title: string;
    abstract: string;
    doi?: string;
    similarity?: number;
    year?: number;
  }>,
): { text: string; validDois: string[] } {
  // Filter articles that have DOI
  const articlesWithDoi = articles.filter((a) => a.doi);

  if (articlesWithDoi.length === 0) {
    return { text: 'No literature with valid DOI available for this section.', validDois: [] };
  }

  const validDois = articlesWithDoi.map((a) => a.doi!);

  const text = articlesWithDoi
    .map((article) => {
      const parts = [
        `[${article.doi}]`,
        `Title: ${article.title}`,
        article.year ? `Year: ${article.year}` : '',
        `DOI: ${article.doi}`,
        `Abstract: ${article.abstract.substring(0, 800)}${article.abstract.length > 800 ? '...' : ''}`,
      ];
      return parts.filter(Boolean).join('\n');
    })
    .join('\n\n');

  return { text, validDois };
}

/**
 * Generate a single review section
 */
export async function generateReviewSection(
  topic: string,
  sectionTitle: string,
  sectionFocus: string,
  literature: string,
): Promise<{
  sectionTitle: string;
  content: string;
  keyFindings: string[];
  citedReferences: Array<{ doi: string; title: string; year?: number; authors?: string; journal?: string }>;
}> {
  const result = await b.GenerateReviewSection(
    topic,
    sectionTitle,
    sectionFocus,
    literature,
  );

  return {
    sectionTitle: result.section_title,
    content: result.content,
    keyFindings: result.key_findings,
    citedReferences: result.cited_references
      .filter((ref) => ref.doi)  // Only include references with DOI
      .map((ref) => ({
        doi: ref.doi,
        title: ref.title,
        year: ref.year || undefined,
        authors: ref.authors || undefined,
        journal: ref.journal || undefined,
      })),
  };
}

/**
 * Generate the abstract for the review
 */
export async function generateReviewAbstract(
  topic: string,
  keyFindings: string,
  totalStudies: number,
): Promise<string> {
  return await b.GenerateReviewAbstract(topic, keyFindings, totalStudies);
}

/**
 * Plan the review structure
 */
export async function planReviewStructure(
  topic: string,
  literatureSummary: string,
): Promise<
  Array<{
    title: string;
    focus: string;
    keywords: string[];
    expectedContent: string;
  }>
> {
  const result = await b.PlanReviewStructure(topic, literatureSummary);

  return result.map((section) => ({
    title: section.section_title,
    focus: section.section_focus,
    keywords: section.search_keywords,
    expectedContent: section.expected_content,
  }));
}

/**
 * Generate conclusions
 */
export async function generateConclusions(
  topic: string,
  sectionSummaries: string,
): Promise<string> {
  return await b.GenerateConclusions(topic, sectionSummaries);
}

/**
 * Main function: Generate complete review
 */
export async function generateReview(
  options: ReviewOptions,
): Promise<ReviewResult> {
  const {
    excelPath,
    topic,
    sections = DEFAULT_SECTIONS,
    outputPath,
    biblibUrl = DEFAULT_BIBLIB_URL,
    embeddingProvider = DEFAULT_EMBEDDING_PROVIDER,
    embeddingModel = DEFAULT_EMBEDDING_MODEL,
    batchSize = DEFAULT_BATCH_SIZE,
    maxArticles = DEFAULT_MAX_ARTICLES,
    skipImport = false,
    onProgress = console.log,
  } = options;

  // Step 1: Read literature from Excel
  onProgress(`Reading literature from ${excelPath}...`);
  const articles = await readLiteratureExcel(excelPath, maxArticles);
  onProgress(`Found ${articles.length} articles`);

  // Step 2: Import to bib-lib (skip if --skip-import)
  let imported = 0;
  let failed = 0;
  if (skipImport) {
    onProgress(`Skipping import step (using existing data)`);
    imported = articles.length;
  } else {
    onProgress(`Importing articles to bib-lib server...`);
    const result = await importAllArticles(articles, {
      biblibUrl,
      embeddingProvider,
      embeddingModel,
      batchSize,
      onProgress,
    });
    imported = result.imported;
    failed = result.failed;
    onProgress(`Import complete: ${imported} success, ${failed} failed`);
  }

  // Step 3: Generate review sections
  onProgress(`Generating review sections...`);
  const generatedSections: Array<{
    title: string;
    content: string;
    keyFindings: string[];
  }> = [];
  const allReferences: Array<{
    doi: string;
    title: string;
    year?: number;
    authors?: string;
    journal?: string;
  }> = [];
  const citedDois = new Set<string>();  // Track cited DOIs to avoid duplicates
  const allValidDois = new Set<string>();  // Track all valid DOIs we've sent to BAML

  for (const sectionTitle of sections) {
    if (sectionTitle === 'Conclusions') continue; // Handle separately

    onProgress(`Generating section: ${sectionTitle}`);

    // Get search query from BAML
    const sectionFocus =
      SECTION_FOCUSES[sectionTitle] || `Overview of ${sectionTitle}`;

    let searchQuery: string;
    try {
      const searchQueryResult = await b.GenerateSearchQuery(topic, sectionTitle, sectionFocus);
      searchQuery = searchQueryResult.primary_query;
      onProgress(`  Generated search query: "${searchQuery}"`);
    } catch (error) {
      // Fallback to simple query if BAML fails
      searchQuery = `${topic} ${sectionTitle}`;
      onProgress(`  BAML search query failed, using fallback: "${searchQuery}"`);
    }

    const relevantArticles = await searchRelevantLiterature(searchQuery, {
      biblibUrl,
      provider: embeddingProvider,
      model: embeddingModel,
      limit: 20,
    });

    // Format literature for BAML - only articles with DOI
    const { text: literatureText, validDois } = formatLiteratureForBaml(relevantArticles);
    validDois.forEach((d) => allValidDois.add(d));

    // Generate section
    try {
      const section = await generateReviewSection(
        topic,
        sectionTitle,
        sectionFocus,
        literatureText,
      );
      generatedSections.push({
        title: section.sectionTitle,
        content: section.content,
        keyFindings: section.keyFindings,
      });

      // Collect unique references - ONLY include DOIs that we actually sent to BAML
      for (const ref of section.citedReferences) {
        // Validate: only accept DOIs that were in our input
        if (allValidDois.has(ref.doi) && !citedDois.has(ref.doi)) {
          citedDois.add(ref.doi);
          allReferences.push(ref);
        }
      }
      onProgress(`  Section ${sectionTitle}: ${section.citedReferences.length} refs, ${section.citedReferences.filter(r => allValidDois.has(r.doi)).length} validated`);
    } catch (error) {
      onProgress(`Error generating section ${sectionTitle}: ${error}`);
      generatedSections.push({
        title: sectionTitle,
        content: `[Error generating this section: ${error}]`,
        keyFindings: [],
      });
    }
  }

  onProgress(`Collected ${allReferences.length} validated references (from ${allValidDois.size} sent)`);

  // Step 4: Generate abstract
  onProgress(`Generating abstract...`);
  const allKeyFindings = generatedSections
    .flatMap((s) => s.keyFindings)
    .join('\n');
  const abstract = await generateReviewAbstract(topic, allKeyFindings, imported);

  // Step 5: Generate conclusions
  let conclusions = '';
  try {
    onProgress(`Generating conclusions...`);
    const sectionSummaries = generatedSections
      .map((s) => `${s.title}: ${s.keyFindings.join('; ')}`)
      .join('\n');
    conclusions = await generateConclusions(topic, sectionSummaries);
  } catch (error) {
    onProgress(`Warning: Conclusions generation failed: ${error}`);
  }

  // Compile result
  const result: ReviewResult = {
    title: topic,
    abstract,
    keywords: [topic, 'review', 'systematic'],
    sections: generatedSections,
    conclusions,
    references: allReferences,
    metadata: {
      totalArticles: articles.length,
      importedArticles: imported,
      generatedAt: new Date().toISOString(),
    },
  };

  // Output to file if specified
  if (outputPath) {
    const markdown = formatReviewAsMarkdown(result);
    fs.writeFileSync(outputPath, markdown, 'utf-8');
    onProgress(`Review saved to ${outputPath}`);
  }

  return result;
}

/**
 * Format review as Markdown
 */
export function formatReviewAsMarkdown(review: ReviewResult): string {
  const lines: string[] = [];

  lines.push(`# ${review.title}`, '');
  lines.push('## Abstract', '');
  lines.push(review.abstract, '');
  lines.push(`**Keywords:** ${review.keywords.join(', ')}`, '');
  lines.push('---', '');

  for (const section of review.sections) {
    lines.push(`## ${section.title}`, '');
    lines.push(section.content, '');

    if (section.keyFindings.length > 0) {
      lines.push('### Key Findings', '');
      section.keyFindings.forEach((finding) => {
        lines.push(`- ${finding}`);
      });
      lines.push('');
    }
  }

  lines.push('## Conclusions', '');
  lines.push(review.conclusions, '');

  // References section
  lines.push('---', '');
  lines.push('## References', '');
  if (review.references && review.references.length > 0) {
    review.references.forEach((ref) => {
      const authors = ref.authors ? `${ref.authors}. ` : '';
      const year = ref.year ? `(${ref.year}). ` : '';
      const journal = ref.journal ? ` *${ref.journal}*` : '';
      lines.push(`[${ref.doi}] ${authors}${year}${ref.title}.${journal} DOI: ${ref.doi}`);
    });
  } else {
    lines.push('No references available.');
  }

  lines.push('');
  lines.push('---', '');
  lines.push('## Metadata', '');
  lines.push(`- Total Articles: ${review.metadata.totalArticles}`, '');
  lines.push(`- Imported Articles: ${review.metadata.importedArticles}`, '');
  lines.push(`- References: ${review.references?.length || 0}`, '');
  lines.push(`- Generated At: ${review.metadata.generatedAt}`, '');

  return lines.join('\n');
}

// Export default function for CLI usage
export default generateReview;
