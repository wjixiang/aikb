import { Test, TestingModule } from '@nestjs/testing';
import { HttpModule, HttpService } from '@nestjs/axios';
import { UmlsService, UmlsInputType, UmlsSearchType, UmlsReturnIdType } from './umls.service';
import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config({ path: '.env' });

describe('UmlsService E2E Tests', () => {
  let service: UmlsService;
  let module: TestingModule;
  let httpService: HttpService;

  // Get API key from environment variables
  const apiKey = process.env['UMLS_API_KEY'] as string;

  beforeAll(async () => {
    if (!apiKey) {
      throw new Error('UMLS_API_KEY not found in environment variables. Please check your .env file.');
    }

    module = await Test.createTestingModule({
      imports: [
        HttpModule.register({
          baseURL: 'https://uts-ws.nlm.nih.gov/rest',
          timeout: 30000,
          maxRedirects: 5,
        })
      ],
      providers: [UmlsService],
    }).compile();

    service = module.get<UmlsService>(UmlsService);
    httpService = module.get<HttpService>(HttpService);
  });

  afterAll(async () => {
    await module.close();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Real API Integration Tests', () => {
    // Test basic search functionality
    describe('searchByTerm', () => {
      it('should search for "diabetes" and return real results', async () => {
        const result = await service.searchByTerm('diabetes', apiKey);
        
        expect(result).toBeDefined();
        expect(result.pageSize).toBeGreaterThan(0);
        expect(result.result).toBeDefined();
        expect(result.result.classType).toBe('searchResults');
        expect(result.result.results).toBeInstanceOf(Array);
        expect(result.result.results.length).toBeGreaterThan(0);
        
        // Check structure of first result
        const firstResult = result.result.results[0];
        expect(firstResult).toHaveProperty('ui');
        expect(firstResult).toHaveProperty('rootSource');
        expect(firstResult).toHaveProperty('uri');
        expect(firstResult).toHaveProperty('name');
        expect(firstResult.name.toLowerCase()).toContain('diabetes');
      }, 30000);

      it('should search for "heart attack" and return cardiology-related concepts', async () => {
        const result = await service.searchByTerm('heart attack', apiKey);
        
        expect(result.result.results.length).toBeGreaterThan(0);
        
        // Should find concepts related to heart attack
        const heartRelatedResults = result.result.results.filter(r => 
          r.name.toLowerCase().includes('heart') || 
          r.name.toLowerCase().includes('myocardial') ||
          r.name.toLowerCase().includes('cardiac')
        );
        expect(heartRelatedResults.length).toBeGreaterThan(0);
      }, 30000);

      it('should handle search with custom options', async () => {
        const result = await service.searchByTerm('fracture', apiKey, {
          searchType: UmlsSearchType.EXACT,
          sabs: ['SNOMEDCT_US'],
          pageSize: 10
        });
        
        expect(result.result.results.length).toBeLessThanOrEqual(10);
        expect(result.pageSize).toBe(10);
      }, 30000);
    });

    // Test code search functionality
    describe('searchForCodes', () => {
      it('should search for codes in SNOMEDCT_US', async () => {
        const result = await service.searchForCodes('diabetes', apiKey, ['SNOMEDCT_US']);
        
        expect(result.result.results.length).toBeGreaterThan(0);
        
        // Results should be from SNOMEDCT_US
        const snomedResults = result.result.results.filter(r => r.rootSource === 'SNOMEDCT_US');
        expect(snomedResults.length).toBeGreaterThan(0);
      }, 30000);

      it('should search for codes in multiple vocabularies', async () => {
        const result = await service.searchForCodes('hypertension', apiKey, ['SNOMEDCT_US', 'ICD10CM']);
        
        expect(result.result.results.length).toBeGreaterThan(0);
        
        // Should have results from both vocabularies
        const sources = new Set(result.result.results.map(r => r.rootSource));
        expect(sources.has('SNOMEDCT_US') || sources.has('ICD10CM')).toBe(true);
      }, 30000);
    });

    // Test code to CUI mapping
    describe('mapCodeToCui', () => {
      it('should map SNOMEDCT_US code to CUI', async () => {
        // Using a known SNOMEDCT_US code for diabetes mellitus
        const result = await service.mapCodeToCui('73211009', apiKey, 'SNOMEDCT_US');
        
        expect(result.result.results.length).toBeGreaterThan(0);
        
        // Should return concept results
        const firstResult = result.result.results[0];
        expect(firstResult.ui).toMatch(/^C\d{7}$/); // CUI format
      }, 30000);

      it('should map ICD10CM code to CUI', async () => {
        // Using a known ICD10CM code for type 2 diabetes mellitus
        const result = await service.mapCodeToCui('E11.9', apiKey, 'ICD10CM');
        
        expect(result.result.results.length).toBeGreaterThan(0);
        
        const firstResult = result.result.results[0];
        expect(firstResult.ui).toMatch(/^C\d{7}$/); // CUI format
      }, 30000);
    });

    // Test CUI to code mapping
    describe('mapCuiToCodes', () => {
      it('should map CUI to SNOMEDCT_US codes', async () => {
        // Using CUI for diabetes mellitus
        const result = await service.mapCuiToCodes('C0011849', apiKey, 'SNOMEDCT_US');
        
        expect(result.result.results.length).toBeGreaterThan(0);
        
        // All results should be from SNOMEDCT_US
        result.result.results.forEach(r => {
          expect(r.rootSource).toBe('SNOMEDCT_US');
        });
      }, 30000);

      it('should map CUI to ICD10CM codes', async () => {
        // Using CUI for diabetes mellitus
        const result = await service.mapCuiToCodes('C0011849', apiKey, 'ICD10CM');
        
        expect(result.result.results.length).toBeGreaterThan(0);
        
        // All results should be from ICD10CM
        result.result.results.forEach(r => {
          expect(r.rootSource).toBe('ICD10CM');
        });
      }, 30000);
    });

    // Test different search types
    describe('Search Types', () => {
      it('should perform exact search', async () => {
        const result = await service.searchByTerm('diabetes mellitus', apiKey, {
          searchType: UmlsSearchType.EXACT
        });
        
        expect(result.result.results.length).toBeGreaterThan(0);
        
        // Results should contain the exact phrase
        const exactMatches = result.result.results.filter(r => 
          r.name.toLowerCase().includes('diabetes mellitus')
        );
        expect(exactMatches.length).toBeGreaterThan(0);
      }, 30000);

      it('should perform words search', async () => {
        const result = await service.searchByTerm('acute myocardial infarction', apiKey, {
          searchType: UmlsSearchType.WORDS
        });
        
        expect(result.result.results.length).toBeGreaterThan(0);
        
        // Should find results containing these words
        const relevantResults = result.result.results.filter(r => {
          const name = r.name.toLowerCase();
          return name.includes('acute') || name.includes('myocardial') || name.includes('infarction');
        });
        expect(relevantResults.length).toBeGreaterThan(0);
      }, 30000);
    });

    // Test different input types
    describe('Input Types', () => {
      it('should search using source concept input type', async () => {
        const result = await service.searchFirstPage({
          string: 'diabetes',
          apiKey,
          inputType: UmlsInputType.SOURCE_CONCEPT,
          returnIdType: UmlsReturnIdType.CONCEPT
        });
        
        expect(result.result.results.length).toBeGreaterThan(0);
      }, 30000);
    });

    // Test pagination and limits
    describe('Pagination', () => {
      it('should respect custom page size', async () => {
        const result = await service.searchByTerm('pain', apiKey, {
          pageSize: 5
        });
        
        expect(result.result.results.length).toBeLessThanOrEqual(5);
        expect(result.pageSize).toBe(5);
      }, 30000);

      it('should handle large page size', async () => {
        const result = await service.searchByTerm('fever', apiKey, {
          pageSize: 100
        });
        
        expect(result.result.results.length).toBeLessThanOrEqual(100);
        expect(result.pageSize).toBe(100);
      }, 30000);
    });

    // Test edge cases
    describe('Edge Cases', () => {
      it('should handle empty search gracefully', async () => {
        // Empty search should throw an error or return no results
        await expect(service.searchByTerm('', apiKey)).rejects.toThrow();
      }, 30000);

      it('should handle special characters in search', async () => {
        const result = await service.searchByTerm('COVID-19', apiKey);
        
        expect(result.result.results.length).toBeGreaterThan(0);
        
        // Should find COVID-19 related concepts
        const covidResults = result.result.results.filter(r => 
          r.name.toLowerCase().includes('covid') ||
          r.name.toLowerCase().includes('coronavirus')
        );
        expect(covidResults.length).toBeGreaterThan(0);
      }, 30000);

      it('should handle very long search terms', async () => {
        const longTerm = 'chronic obstructive pulmonary disease with acute exacerbation';
        const result = await service.searchByTerm(longTerm, apiKey);
        
        expect(result).toBeDefined();
        expect(result.result.results).toBeInstanceOf(Array);
      }, 30000);
    });

    // Test API response structure
    describe('Response Structure', () => {
      it('should maintain consistent response structure across different searches', async () => {
        const searches = ['diabetes', 'cancer', 'heart disease'];
        
        for (const searchTerm of searches) {
          const result = await service.searchByTerm(searchTerm, apiKey);
          
          // Check response structure
          expect(result).toHaveProperty('pageSize');
          expect(result).toHaveProperty('result');
          expect(result.result).toHaveProperty('classType', 'searchResults');
          expect(result.result).toHaveProperty('results');
          
          // Check result structure
          if (result.result.results.length > 0) {
            const firstResult = result.result.results[0];
            expect(firstResult).toHaveProperty('ui');
            expect(firstResult).toHaveProperty('rootSource');
            expect(firstResult).toHaveProperty('uri');
            expect(firstResult).toHaveProperty('name');
          }
        }
      }, 45000);
    });
  });
});