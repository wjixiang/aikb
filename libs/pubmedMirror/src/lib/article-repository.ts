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
