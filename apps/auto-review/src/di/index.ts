/**
 * Simple dependency injection container using closures.
 * Manages singleton instances of services.
 */

import { PrismaService } from '../prisma/prisma.service.js';
import { BamlService } from '../app/baml/baml.service.js';
import { SearchService } from '../search/search.service.js';
import { ArticleAnalysisService } from '../article-analysis/article-analysis.service.js';
import { LiteratureSummaryService } from '../literature-summary/literature-summary.service.js';
import { EpidemiologySearchEngine } from '../article-search/epidemiology.engine.js';
import type { BaseSearchEngine, ReviewSection } from '../article-search/base.engine.js';
import { config } from '../config.js';

// Service container type
export interface ServiceContainer {
  prisma: PrismaService;
  baml: BamlService;
  search: SearchService;
  articleAnalysis: ArticleAnalysisService;
  literatureSummary: LiteratureSummaryService;
  // Search engines for different review sections
  epidemiologyEngine: EpidemiologySearchEngine;
  pathophysiologyEngine: BaseSearchEngine;
  clinicalEngine: BaseSearchEngine;
  treatmentEngine: BaseSearchEngine;
}

// Singleton instances
let _container: ServiceContainer | null = null;

/**
 * Initialize the service container
 */
export async function initContainer(): Promise<ServiceContainer> {
  if (_container) {
    return _container;
  }

  // Initialize Prisma first (it has no dependencies)
  const prisma = new PrismaService();
  await prisma.init();

  // Initialize BAML service
  const baml = new BamlService();
  await baml.init();

  // Initialize search service (uses PubmedService internally, no dependencies)
  const search = new SearchService();

  // Initialize article analysis service
  const articleAnalysis = new ArticleAnalysisService();

  // Initialize literature summary service
  const literatureSummary = new LiteratureSummaryService();

  // Initialize specialized search engines (each depends on BAML)
  const epidemiologyEngine = new EpidemiologySearchEngine(baml);
  const { PathophysiologySearchEngine } = await import('../article-search/pathophysiology.engine.js');
  const { ClinicalManifestationsSearchEngine } = await import('../article-search/clinical.engine.js');
  const { TreatmentSearchEngine } = await import('../article-search/treatment.engine.js');

  const pathophysiologyEngine = new PathophysiologySearchEngine(baml);
  const clinicalEngine = new ClinicalManifestationsSearchEngine(baml);
  const treatmentEngine = new TreatmentSearchEngine(baml);

  _container = {
    prisma,
    baml,
    search,
    articleAnalysis,
    literatureSummary,
    epidemiologyEngine,
    pathophysiologyEngine,
    clinicalEngine,
    treatmentEngine,
  };

  return _container;
}

/**
 * Get the service container (must be initialized first)
 */
export function getContainer(): ServiceContainer {
  if (!_container) {
    throw new Error('Service container not initialized. Call initContainer() first.');
  }
  return _container;
}

/**
 * Cleanup service container
 */
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
