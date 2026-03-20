/**
 * Simple dependency injection container using closures.
 * Manages singleton instances of services.
 */

import { PrismaService } from '../prisma/prisma.service.js';
import { BamlService } from '../app/baml/baml.service.js';
import { SearchService } from '../search/search.service.js';
import { SearchResultService } from '../search/search-result.service.js';
import { ArticleEmbeddingService } from '../search/article-embedding.service.js';
import { ArticleAnalysisService } from '../article-analysis/article-analysis.service.js';
import { LiteratureSummaryService } from '../literature-summary/literature-summary.service.js';
import { EpidemiologySearchEngine } from '../article-search/epidemiology.engine.js';
import type {
  BaseSearchEngine,
  ReviewSection,
} from '../article-search/base.engine.js';
import { config } from '../config.js';

export interface ServiceContainer {
  prisma: PrismaService;
  baml: BamlService;
  search: SearchService;
  searchResult: SearchResultService;
  embedding: ArticleEmbeddingService;
  articleAnalysis: ArticleAnalysisService;
  literatureSummary: LiteratureSummaryService;
  epidemiologyEngine: EpidemiologySearchEngine;
  pathophysiologyEngine: BaseSearchEngine;
  clinicalEngine: BaseSearchEngine;
  treatmentEngine: BaseSearchEngine;
}

let _container: ServiceContainer | null = null;

export async function initContainer(): Promise<ServiceContainer> {
  if (_container) {
    return _container;
  }

  const prisma = new PrismaService();
  await prisma.init();

  const baml = new BamlService();
  await baml.init();

  const search = new SearchService();

  const searchResult = new SearchResultService(prisma);
  const embedding = new ArticleEmbeddingService(prisma);

  const articleAnalysis = new ArticleAnalysisService();

  const literatureSummary = new LiteratureSummaryService();

  const epidemiologyEngine = new EpidemiologySearchEngine(
    baml,
    searchResult,
    embedding,
  );
  const { PathophysiologySearchEngine } = await import(
    '../article-search/pathophysiology.engine.js'
  );
  const { ClinicalManifestationsSearchEngine } = await import(
    '../article-search/clinical.engine.js'
  );
  const { TreatmentSearchEngine } = await import(
    '../article-search/treatment.engine.js'
  );

  const pathophysiologyEngine = new PathophysiologySearchEngine(
    baml,
    searchResult,
    embedding,
  );
  const clinicalEngine = new ClinicalManifestationsSearchEngine(
    baml,
    searchResult,
    embedding,
  );
  const treatmentEngine = new TreatmentSearchEngine(
    baml,
    searchResult,
    embedding,
  );

  _container = {
    prisma,
    baml,
    search,
    searchResult,
    embedding,
    articleAnalysis,
    literatureSummary,
    epidemiologyEngine,
    pathophysiologyEngine,
    clinicalEngine,
    treatmentEngine,
  };

  return _container;
}

export function getContainer(): ServiceContainer {
  if (!_container) {
    throw new Error(
      'Service container not initialized. Call initContainer() first.',
    );
  }
  return _container;
}

export async function destroyContainer(): Promise<void> {
  if (!_container) {
    return;
  }

  try {
    await _container.prisma.destroy();
  } catch (error) {
    console.error('Error destroying Prisma service:', error);
  }

  _container = null;
}
