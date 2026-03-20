import { BamlService } from '../app/baml/baml.service.js';
import { BaseSearchEngine, ReviewSection, SearchResult } from './base.engine.js';
import type { SearchStrategy, ProgressCallback } from './base.engine.js';
import { EpidemiologySearchEngine } from './epidemiology.engine.js';
import { PathophysiologySearchEngine } from './pathophysiology.engine.js';
import { ClinicalManifestationsSearchEngine } from './clinical.engine.js';
import { TreatmentSearchEngine } from './treatment.engine.js';

export type { ReviewSection, SearchResult, SearchStrategy, ProgressCallback };
export { BaseSearchEngine };
export { EpidemiologySearchEngine };
export { PathophysiologySearchEngine };
export { ClinicalManifestationsSearchEngine };
export { TreatmentSearchEngine };

/**
 * Factory function to create a search engine for a specific section
 */
export function createSearchEngine(
  section: ReviewSection,
  bamlService: BamlService,
): BaseSearchEngine {
  switch (section) {
    case 'epidemiology':
      return new EpidemiologySearchEngine(bamlService);
    case 'pathophysiology':
      return new PathophysiologySearchEngine(bamlService);
    case 'clinical':
      return new ClinicalManifestationsSearchEngine(bamlService);
    case 'treatment':
      return new TreatmentSearchEngine(bamlService);
    default:
      throw new Error(`Unknown review section: ${section}`);
  }
}

/**
 * Run search for a specific section
 */
export async function runSectionSearch(
  section: ReviewSection,
  disease: string,
  bamlService: BamlService,
  onProgress?: ProgressCallback,
): Promise<SearchResult> {
  const engine = createSearchEngine(section, bamlService);
  return engine.run(disease, onProgress);
}

/**
 * Run multiple section searches sequentially
 */
export async function runAllSectionSearches(
  disease: string,
  bamlService: BamlService,
  onProgress?: (section: ReviewSection, state: {
    iteration: number;
    strategy: SearchStrategy;
    result: SearchResult | null;
    adjustment: unknown;
    evaluation?: unknown;
  }) => void | Promise<void>,
): Promise<Record<ReviewSection, SearchResult>> {
  const sections: ReviewSection[] = ['epidemiology', 'pathophysiology', 'clinical', 'treatment'];
  const results = {} as Record<ReviewSection, SearchResult>;

  for (const section of sections) {
    const sectionProgressCallback: ProgressCallback = async (state) => {
      if (onProgress) {
        await onProgress(section, state);
      }
    };

    const result = await runSectionSearch(section, disease, bamlService, sectionProgressCallback);
    results[section] = result;
  }

  return results;
}
