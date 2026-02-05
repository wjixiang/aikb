import { PrismaClient } from '../generated/prisma/client.js';
import { PrismaArticleRepository } from './prismaArticleRepository.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Transformed data for MedlineCitation
 */
export interface MedlineCitationCreateData {
    pmid: number;
    dateCompleted: Date | null;
    dateRevised: Date;
    citationSubset: string;
    // journalId: number;
}

/**
 * Transformed data for Article
 */
export interface ArticleCreateData {
    pmid: number;
    journalId: number;
    articleTitle: string;
    pagination?: string;
    language: string | null;
    publicationTypes: string[];
}

/**
 * Transformed data for Author
 */
export interface AuthorCreateData {
    articleId: number;
    lastName: string | null;
    foreName: string | null;
    initials: string | null;
    affiliation: string | null;
}

/**
 * Transformed data for Grant
 */
export interface GrantCreateData {
    articleId: number;
    grantId: string | null;
    acronym: string | null;
    agency: string | null;
    country: string | null;
}

/**
 * Transformed data for MedlineJournalInfo
 */
export interface MedlineJournalInfoCreateData {
    pmid: number;
    country: string | null;
    title: string | null;
    medlineTA: string | null;
    ISOAbbreviation: string | null;
    nlmUniqueId: number | null;
    issnLinking: string | null;
}

/**
 * Transformed data for Chemical
 */
export interface ChemicalCreateData {
    pmid: number;
    registryNumber: string;
    nameOfSubstance: string;
}

/**
 * Transformed data for MeshHeading
 */
export interface MeshHeadingCreateData {
    pmid: number;
    descriptorName: string;
    qualifierNames: string[];
}

/**
 * Transformed data for PubMedData
 */
export interface PubMedDataCreateData {
    pmid: number;
    publicationStatus: string | null;
    articleIds: any[];
    history: any[];
}

/**
 * Result of syncing a single article
 */
export interface SyncArticleResult {
    pmid: number;
    success: boolean;
    error?: string;
}

/**
 * Transformed data for ArticleDetail from detail page
 */
export interface ArticleDetailCreateData {
    pmid: number;
    doi?: string;
    title: string;
    abstract?: string;
    conflictOfInterestStatement?: string;
}

/**
 * Transformed data for ArticleDetailAuthor
 */
export interface ArticleDetailAuthorCreateData {
    name: string;
    position?: number;
    affiliations: ArticleDetailAuthorAffiliationCreateData[];
}

/**
 * Transformed data for ArticleDetailAuthorAffiliation
 */
export interface ArticleDetailAuthorAffiliationCreateData {
    institution?: string;
    city?: string;
    country?: string;
    email?: string;
}

/**
 * Transformed data for ArticleDetailAffiliation (article level)
 */
export interface ArticleDetailAffiliationCreateData {
    institution?: string;
    city?: string;
    country?: string;
    email?: string;
}

/**
 * Transformed data for ArticleDetailKeyword
 */
export interface ArticleDetailKeywordCreateData {
    text: string;
    isMeSH?: boolean;
}

/**
 * Transformed data for ArticleDetailSimilarArticle
 */
export interface ArticleDetailSimilarArticleCreateData {
    pmid: string;
    title: string;
}

/**
 * Transformed data for ArticleDetailReference
 */
export interface ArticleDetailReferenceCreateData {
    pmid?: string;
    citation: string;
}

/**
 * Transformed data for ArticleDetailPublicationType
 */
export interface ArticleDetailPublicationTypeCreateData {
    type: string;
}

/**
 * Transformed data for ArticleDetailMeshTerm
 */
export interface ArticleDetailMeshTermCreateData {
    text: string;
    isMeSH?: boolean;
}

/**
 * Transformed data for ArticleDetailRelatedInformation
 */
export interface ArticleDetailRelatedInformationCreateData {
    category: string;
    text: string;
    url?: string;
}

/**
 * Transformed data for ArticleDetailFullTextSource
 */
export interface ArticleDetailFullTextSourceCreateData {
    name: string;
    url: string;
    type?: string;
}

/**
 * Transformed data for ArticleDetailJournalInfo
 */
export interface ArticleDetailJournalInfoCreateData {
    title?: string;
    volume?: string;
    issue?: string;
    pages?: string;
    pubDate?: string;
}

/**
 * All data for syncing article detail
 */
export interface ArticleDetailSyncData {
    detail: ArticleDetailCreateData;
    authors: ArticleDetailAuthorCreateData[];
    affiliations: ArticleDetailAffiliationCreateData[];
    keywords: ArticleDetailKeywordCreateData[];
    similarArticles: ArticleDetailSimilarArticleCreateData[];
    references: ArticleDetailReferenceCreateData[];
    publicationTypes: ArticleDetailPublicationTypeCreateData[];
    meshTerms: ArticleDetailMeshTermCreateData[];
    relatedInformation: ArticleDetailRelatedInformationCreateData[];
    fullTextSources: ArticleDetailFullTextSourceCreateData[];
    journalInfo: ArticleDetailJournalInfoCreateData | null;
}

// ============================================================================
// Repository Interface
// ============================================================================

/**
 * Interface for article database operations
 * This allows for easy testing with mock implementations
 */
export interface IArticleRepository {
    /**
     * Sync a single article with all its related data
     * @param pmid - The PubMed ID
     * @param citationData - MedlineCitation data
     * @param articleData - Article data (optional)
     * @param authors - Array of authors (optional)
     * @param grants - Array of grants (optional)
     * @param journalInfoData - MedlineJournalInfo data (optional)
     * @param chemicals - Array of chemicals (optional)
     * @param meshHeadings - Array of mesh headings (optional)
     * @param pubmedData - PubMedData (optional)
     */
    syncArticle(
        pmid: number,
        citationData: MedlineCitationCreateData,
        articleData: ArticleCreateData | null,
        authors: AuthorCreateData[],
        grants: GrantCreateData[],
        journalInfoData: MedlineJournalInfoCreateData | null,
        chemicals: ChemicalCreateData[],
        meshHeadings: MeshHeadingCreateData[],
        pubmedData: PubMedDataCreateData | null
    ): Promise<SyncArticleResult>;

    /**
     * Find all articles without Abstract record
     * @param take The number of returned results per request
     * @param lastPmid Cursor for pagination
     * @returns Array of PubMed ID
     */
    findArticleWithoutAbstract(
        take: number,
        lastPmid: number
    ): Promise<number[]>

    /**
     * Sync article detail data from PubMed detail page
     * @param data - All article detail data
     */
    syncArticleDetail(data: ArticleDetailSyncData): Promise<SyncArticleResult>
}


// ============================================================================
// Factory
// ============================================================================

/**
 * Create a new article repository instance
 * @param prisma - The Prisma client instance
 */
export const createArticleRepository = (prisma: PrismaClient): IArticleRepository => {
    return new PrismaArticleRepository(prisma);
};
