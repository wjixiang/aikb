import { Test, TestingModule } from '@nestjs/testing';
import { HttpModule, HttpService } from '@nestjs/axios';
import { of } from 'rxjs';
import { AxiosResponse } from 'axios';
import { vi, type Mock } from 'vitest';
import {
  UmlsService,
  UmlsInputType,
  UmlsSearchType,
  UmlsReturnIdType,
} from './umls.service';

describe('UmlsService', () => {
  let service: UmlsService;
  let httpService: HttpService;

  const mockApiKey = 'test-api-key';
  const mockResponse: AxiosResponse = {
    data: {
      pageSize: 200,
      result: {
        classType: 'searchResults',
        results: [
          {
            ui: 'C0009044',
            rootSource: 'SNOMEDCT_US',
            uri: 'https://uts-ws.nlm.nih.gov/rest/content/2015AA/CUI/C0009044',
            name: 'Closed fracture carpal bone',
          },
          {
            ui: 'C0016644',
            rootSource: 'MTH',
            uri: 'https://uts-ws.nlm.nih.gov/rest/content/2015AA/CUI/C0016644',
            name: 'Fracture of carpal bone',
          },
        ],
      },
    },
    status: 200,
    statusText: 'OK',
    headers: {},
    config: {} as any,
  };

  beforeEach(async () => {
    const mockHttpService = {
      get: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      imports: [HttpModule],
      providers: [UmlsService],
    })
      .overrideProvider(HttpService)
      .useValue(mockHttpService)
      .compile();

    service = module.get<UmlsService>(UmlsService);
    httpService = module.get<HttpService>(HttpService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('search', () => {
    it('should return an Observable with search results', () => {
      const params = {
        string: 'fracture of carpal bone',
        apiKey: mockApiKey,
      };

      vi.spyOn(httpService, 'get').mockReturnValue(of(mockResponse));

      const result$ = service.search(params);
      result$.subscribe((response) => {
        expect(response.data).toEqual(mockResponse.data);
      });

      expect(httpService.get).toHaveBeenCalledWith(
        expect.stringContaining('string=fracture+of+carpal+bone'),
      );
      expect(httpService.get).toHaveBeenCalledWith(
        expect.stringContaining('apiKey=test-api-key'),
      );
    });

    it('should include optional parameters in the URL', () => {
      const params = {
        string: 'fracture',
        apiKey: mockApiKey,
        inputType: UmlsInputType.CODE,
        searchType: UmlsSearchType.EXACT,
        returnIdType: UmlsReturnIdType.CODE,
        sabs: ['SNOMEDCT_US', 'ICD10CM'],
        includeObsolete: true,
        includeSuppressible: false,
        partialSearch: true,
        pageSize: 100,
      };

      vi.spyOn(httpService, 'get').mockReturnValue(of(mockResponse));

      service.search(params).subscribe();

      const calledUrl = (httpService.get as Mock).mock.calls[0][0];
      expect(calledUrl).toContain('inputType=code');
      expect(calledUrl).toContain('searchType=exact');
      expect(calledUrl).toContain('returnIdType=code');
      expect(calledUrl).toContain('sabs=SNOMEDCT_US%2CICD10CM');
      expect(calledUrl).toContain('includeObsolete=true');
      expect(calledUrl).toContain('includeSuppressible=false');
      expect(calledUrl).toContain('partialSearch=true');
      expect(calledUrl).toContain('pageSize=100');
    });
  });

  describe('searchFirstPage', () => {
    it('should return search results as a Promise', async () => {
      const params = {
        string: 'diabetes',
        apiKey: mockApiKey,
      };

      vi.spyOn(httpService, 'get').mockReturnValue(of(mockResponse));

      const result = await service.searchFirstPage(params);
      expect(result).toEqual(mockResponse.data);
    });

    it('should throw error when response is undefined', async () => {
      const params = {
        string: 'test',
        apiKey: mockApiKey,
      };

      vi.spyOn(httpService, 'get').mockReturnValue(of(undefined as any));

      await expect(service.searchFirstPage(params)).rejects.toThrow(
        'No response received from UMLS API',
      );
    });
  });

  describe('searchByTerm', () => {
    it('should search for CUIs by term', async () => {
      vi.spyOn(httpService, 'get').mockReturnValue(of(mockResponse));

      const result = await service.searchByTerm('fracture', mockApiKey);
      expect(result).toEqual(mockResponse.data);

      const calledUrl = (httpService.get as Mock).mock.calls[0][0];
      expect(calledUrl).toContain('string=fracture');
      expect(calledUrl).toContain('returnIdType=concept');
    });

    it('should accept additional options', async () => {
      vi.spyOn(httpService, 'get').mockReturnValue(of(mockResponse));

      await service.searchByTerm('fracture', mockApiKey, {
        searchType: UmlsSearchType.EXACT,
        sabs: ['SNOMEDCT_US'],
      });

      const calledUrl = (httpService.get as Mock).mock.calls[0][0];
      expect(calledUrl).toContain('searchType=exact');
      expect(calledUrl).toContain('sabs=SNOMEDCT_US');
    });
  });

  describe('searchForCodes', () => {
    it('should search for source-asserted identifiers', async () => {
      vi.spyOn(httpService, 'get').mockReturnValue(of(mockResponse));

      const result = await service.searchForCodes('fracture', mockApiKey, [
        'SNOMEDCT_US',
      ]);
      expect(result).toEqual(mockResponse.data);

      const calledUrl = (httpService.get as Mock).mock.calls[0][0];
      expect(calledUrl).toContain('returnIdType=code');
      expect(calledUrl).toContain('sabs=SNOMEDCT_US');
    });

    it('should work with empty sabs array', async () => {
      vi.spyOn(httpService, 'get').mockReturnValue(of(mockResponse));

      await service.searchForCodes('fracture', mockApiKey);

      const calledUrl = (httpService.get as Mock).mock.calls[0][0];
      expect(calledUrl).toContain('returnIdType=code');
      expect(calledUrl).not.toContain('sabs=');
    });
  });

  describe('mapCodeToCui', () => {
    it('should map source code to UMLS CUI', async () => {
      vi.spyOn(httpService, 'get').mockReturnValue(of(mockResponse));

      const result = await service.mapCodeToCui(
        '9468002',
        mockApiKey,
        'SNOMEDCT_US',
      );
      expect(result).toEqual(mockResponse.data);

      const calledUrl = (httpService.get as Mock).mock.calls[0][0];
      expect(calledUrl).toContain('string=9468002');
      expect(calledUrl).toContain('inputType=sourceUi');
      expect(calledUrl).toContain('searchType=exact');
      expect(calledUrl).toContain('sabs=SNOMEDCT_US');
      expect(calledUrl).toContain('returnIdType=concept');
    });
  });

  describe('mapCuiToCodes', () => {
    it('should map UMLS CUI to source codes', async () => {
      vi.spyOn(httpService, 'get').mockReturnValue(of(mockResponse));

      const result = await service.mapCuiToCodes(
        'C0009044',
        mockApiKey,
        'SNOMEDCT_US',
      );
      expect(result).toEqual(mockResponse.data);

      const calledUrl = (httpService.get as Mock).mock.calls[0][0];
      expect(calledUrl).toContain('string=C0009044');
      expect(calledUrl).toContain('sabs=SNOMEDCT_US');
      expect(calledUrl).toContain('returnIdType=code');
    });
  });

  describe('URL building', () => {
    it('should use correct base URL and version', async () => {
      vi.spyOn(httpService, 'get').mockReturnValue(of(mockResponse));

      await service.searchByTerm('test', mockApiKey);

      const calledUrl = (httpService.get as Mock).mock.calls[0][0];
      expect(calledUrl).toContain(
        'https://uts-ws.nlm.nih.gov/rest/search/current',
      );
    });

    it('should use custom version when specified', async () => {
      vi.spyOn(httpService, 'get').mockReturnValue(of(mockResponse));

      await service
        .search({
          string: 'test',
          apiKey: mockApiKey,
          version: '2023AB',
        })
        .subscribe();

      const calledUrl = (httpService.get as Mock).mock.calls[0][0];
      expect(calledUrl).toContain(
        'https://uts-ws.nlm.nih.gov/rest/search/2023AB',
      );
    });

    it('should use default pageSize of 200 when not specified', async () => {
      vi.spyOn(httpService, 'get').mockReturnValue(of(mockResponse));

      await service.searchByTerm('test', mockApiKey);

      const calledUrl = (httpService.get as Mock).mock.calls[0][0];
      expect(calledUrl).toContain('pageSize=200');
    });

    it('should properly encode special characters in search string', async () => {
      vi.spyOn(httpService, 'get').mockReturnValue(of(mockResponse));

      await service.searchByTerm('fracture of carpal bone', mockApiKey);

      const calledUrl = (httpService.get as Mock).mock.calls[0][0];
      expect(calledUrl).toContain('string=fracture+of+carpal+bone');
    });
  });
});
