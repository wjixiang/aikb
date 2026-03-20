/**
 * Simple dependency injection container using closures.
 * Manages singleton instances of services.
 */

import { PrismaService } from '../prisma/prisma.service.js';
import { BamlService } from '../app/baml/baml.service.js';
import { SearchService } from '../search/search.service.js';
import { ArticleAnalysisService } from '../article-analysis/article-analysis.service.js';
import { LiteratureSummaryService } from '../literature-summary/literature-summary.service.js';
import { EpidemiologyResearchEngine } from '../app/task.js';
import { config } from '../config.js';

// Service container type
export interface ServiceContainer {
  prisma: PrismaService;
  baml: BamlService;
  search: SearchService;
  articleAnalysis: ArticleAnalysisService;
  literatureSummary: LiteratureSummaryService;
  researchEngine: EpidemiologyResearchEngine;
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

  // Initialize research engine (depends on BAML and Prisma)
  const researchEngine = new EpidemiologyResearchEngine(baml, prisma);

  _container = {
    prisma,
    baml,
    search,
    articleAnalysis,
    literatureSummary,
    researchEngine,
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
