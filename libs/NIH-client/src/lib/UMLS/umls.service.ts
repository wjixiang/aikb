import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { AxiosResponse } from 'axios';
import { Observable } from 'rxjs';

// UMLS API Types
export enum UmlsInputType {
  ATOM = 'atom',
  CODE = 'code',
  SOURCE_CONCEPT = 'sourceConcept',
  SOURCE_DESCRIPTOR = 'sourceDescriptor',
  SOURCE_UI = 'sourceUi',
  TTY = 'tty'
}

export enum UmlsSearchType {
  WORDS = 'words',
  EXACT = 'exact',
  LEFT_TRUNCATION = 'leftTruncation',
  RIGHT_TRUNCATION = 'rightTruncation',
  NORMALIZED_STRING = 'normalizedString',
  NORMALIZED_WORDS = 'normalizedWords'
}

export enum UmlsReturnIdType {
  AUI = 'aui',
  CONCEPT = 'concept',
  CODE = 'code',
  SOURCE_CONCEPT = 'sourceConcept',
  SOURCE_DESCRIPTOR = 'sourceDescriptor',
  SOURCE_UI = 'sourceUi'
}

export interface UmlsSearchResult {
  ui: string;
  rootSource: string;
  uri: string;
  name: string;
}

export interface UmlsSearchResults {
  classType: 'searchResults';
  results: UmlsSearchResult[];
}

export interface UmlsSearchResponse {
  pageSize: number;
  result: UmlsSearchResults;
}

export interface UmlsSearchParams {
  string: string;
  apiKey: string;
  inputType?: UmlsInputType;
  includeObsolete?: boolean;
  includeSuppressible?: boolean;
  returnIdType?: UmlsReturnIdType;
  sabs?: string[];
  searchType?: UmlsSearchType;
  partialSearch?: boolean;
  pageSize?: number;
  version?: string;
}

@Injectable()
export class UmlsService {
  constructor(private readonly httpService: HttpService) {}

  /**
   * Search UMLS for concepts matching the given term
   * @param params Search parameters
   * @returns Observable of UMLS search response
   */
  search(params: UmlsSearchParams): Observable<AxiosResponse<UmlsSearchResponse>> {
    const url = this.buildSearchUrl(params);
    return this.httpService.get<UmlsSearchResponse>(url);
  }

  /**
   * Search UMLS and return the first page of results
   * @param params Search parameters
   * @returns Promise of UMLS search response
   */
  async searchFirstPage(params: UmlsSearchParams): Promise<UmlsSearchResponse> {
    const url = this.buildSearchUrl(params);
    const response = await this.httpService.get<UmlsSearchResponse>(url).toPromise();
    if (!response) {
      throw new Error('No response received from UMLS API');
    }
    return response.data;
  }

  /**
   * Search for CUIs by human readable term (default behavior)
   * @param term Search term
   * @param apiKey UMLS API key
   * @param options Additional search options
   * @returns Promise of UMLS search response
   */
  async searchByTerm(
    term: string,
    apiKey: string,
    options: Partial<Omit<UmlsSearchParams, 'string' | 'apiKey'>> = {}
  ): Promise<UmlsSearchResponse> {
    return this.searchFirstPage({
      string: term,
      apiKey,
      returnIdType: UmlsReturnIdType.CONCEPT,
      ...options
    });
  }

  /**
   * Search for source-asserted identifiers by human readable term
   * @param term Search term
   * @param apiKey UMLS API key
   * @param sabs Source vocabularies to search
   * @param options Additional search options
   * @returns Promise of UMLS search response
   */
  async searchForCodes(
    term: string,
    apiKey: string,
    sabs: string[] = [],
    options: Partial<Omit<UmlsSearchParams, 'string' | 'apiKey' | 'sabs'>> = {}
  ): Promise<UmlsSearchResponse> {
    return this.searchFirstPage({
      string: term,
      apiKey,
      returnIdType: UmlsReturnIdType.CODE,
      sabs,
      ...options
    });
  }

  /**
   * Map source-asserted identifiers to UMLS CUIs
   * @param code Source code
   * @param apiKey UMLS API key
   * @param sabs Source vocabulary
   * @param options Additional search options
   * @returns Promise of UMLS search response
   */
  async mapCodeToCui(
    code: string,
    apiKey: string,
    sabs: string,
    options: Partial<Omit<UmlsSearchParams, 'string' | 'apiKey' | 'sabs' | 'inputType' | 'searchType'>> = {}
  ): Promise<UmlsSearchResponse> {
    return this.searchFirstPage({
      string: code,
      apiKey,
      inputType: UmlsInputType.SOURCE_UI,
      searchType: UmlsSearchType.EXACT,
      sabs: [sabs],
      returnIdType: UmlsReturnIdType.CONCEPT,
      ...options
    });
  }

  /**
   * Map UMLS CUI to source-asserted identifiers
   * @param cui UMLS CUI
   * @param apiKey UMLS API key
   * @param sabs Source vocabulary
   * @param options Additional search options
   * @returns Promise of UMLS search response
   */
  async mapCuiToCodes(
    cui: string,
    apiKey: string,
    sabs: string,
    options: Partial<Omit<UmlsSearchParams, 'string' | 'apiKey' | 'sabs' | 'returnIdType'>> = {}
  ): Promise<UmlsSearchResponse> {
    return this.searchFirstPage({
      string: cui,
      apiKey,
      sabs: [sabs],
      returnIdType: UmlsReturnIdType.CODE,
      ...options
    });
  }

  /**
   * Build the search URL with query parameters
   * @param params Search parameters
   * @returns Complete search URL
   */
  private buildSearchUrl(params: UmlsSearchParams): string {
    const baseUrl = 'https://uts-ws.nlm.nih.gov/rest';
    const version = params.version || 'current';
    let url = `${baseUrl}/search/${version}`;

    const queryParams = new URLSearchParams();

    // Required parameters
    queryParams.append('string', params.string);
    queryParams.append('apiKey', params.apiKey);

    // Optional parameters
    if (params.inputType) {
      queryParams.append('inputType', params.inputType);
    }
    if (params.includeObsolete !== undefined) {
      queryParams.append('includeObsolete', params.includeObsolete.toString());
    }
    if (params.includeSuppressible !== undefined) {
      queryParams.append('includeSuppressible', params.includeSuppressible.toString());
    }
    if (params.returnIdType) {
      queryParams.append('returnIdType', params.returnIdType);
    }
    if (params.sabs && params.sabs.length > 0) {
      queryParams.append('sabs', params.sabs.join(','));
    }
    if (params.searchType) {
      queryParams.append('searchType', params.searchType);
    }
    if (params.partialSearch !== undefined) {
      queryParams.append('partialSearch', params.partialSearch.toString());
    }
    if (params.pageSize) {
      queryParams.append('pageSize', params.pageSize.toString());
    } else {
      queryParams.append('pageSize', '200'); // Default page size
    }

    return `${url}?${queryParams.toString()}`;
  }
}
