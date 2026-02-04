import { listSyncedBaselineFiles, downloadBaselineFile } from "./oss-storage.js"
import zlib from 'zlib';
import { promisify } from 'util';
import { XMLParser } from 'fast-xml-parser';
import { PrismaClient } from '../generated/prisma/client.js';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import {
    createArticleRepository,
    IArticleRepository,
    type SyncArticleResult,
} from './article-repository.js';

const gunzip = promisify(zlib.gunzip);

// ============================================================================
// Types
// ============================================================================

interface MedlineDate {
    Year?: string;
    Month?: string;
    Day?: string;
    Hour?: string;
    Minute?: string;
}

interface MedlineCitationData {
    PMID: string | number | Record<string, any>;
    DateCompleted?: MedlineDate;
    DateRevised?: MedlineDate;
    Article?: ArticleData;
    MedlineJournalInfo?: MedlineJournalInfoData;
    ChemicalList?: { Chemical?: ChemicalData[] };
    CitationSubset?: string | string[];
    MeshHeadingList?: { MeshHeading?: MeshHeadingData[] };
}

interface ArticleData {
    Journal?: Record<string, any>;
    ArticleTitle?: string;
    Pagination?: { MedlinePgn?: string };
    AuthorList?: { Author?: AuthorData[] };
    Language?: string;
    GrantList?: { Grant?: GrantData[] };
    PublicationTypeList?: { PublicationType?: string[] };
}

interface AuthorData {
    LastName?: string;
    ForeName?: string;
    Initials?: string;
    Affiliation?: string;
}

interface GrantData {
    GrantID?: string | number;
    Acronym?: string;
    Agency?: string;
    Country?: string;
}

interface MedlineJournalInfoData {
    Country?: string;
    MedlineTA?: string;
    NlmUniqueID?: string | number;
    ISSNLinking?: string;
}

interface ChemicalData {
    RegistryNumber?: string | number;
    NameOfSubstance?: string | Record<string, any>;
}

interface MeshHeadingData {
    DescriptorName?: string | Record<string, any>;
    QualifierName?: string | string[] | Record<string, any>;
}

interface PubMedData {
    History?: { PubMedPubDate?: MedlineDate[] };
    PublicationStatus?: string;
    ArticleIdList?: { ArticleId?: (string | number)[] };
}

interface PubmedArticle {
    MedlineCitation?: MedlineCitationData;
    PubmedData?: PubMedData;
}

// ============================================================================
// Prisma Client
// ============================================================================

let prismaInstance: PrismaClient | null = null;

/**
 * Get or create Prisma client instance
 */
export const getPrismaClient = (): PrismaClient => {
    if (!prismaInstance) {
        const connectionString = process.env['DATABASE_URL'];
        if (!connectionString) {
            throw new Error('DATABASE_URL environment variable is not set');
        }

        const pool = new pg.Pool({ connectionString });
        const adapter = new PrismaPg(pool);
        prismaInstance = new PrismaClient({
            adapter,
            transactionOptions: {
                timeout: 60000, // 60 seconds
                maxWait: 60000,
            },
        });
    }
    return prismaInstance;
};

/**
 * Close Prisma client connection
 */
export const closePrismaClient = async (): Promise<void> => {
    if (prismaInstance) {
        await prismaInstance.$disconnect();
        prismaInstance = null;
    }
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Parse MedlineDate to DateTime string
 */
const parseMedlineDate = (date?: MedlineDate): Date | null => {
    if (!date) return null;
    const { Year, Month, Day, Hour, Minute } = date;

    if (!Year) return null;

    const month = Month || '01';
    const day = Day || '01';
    const hour = Hour || '00';
    const minute = Minute || '00';

    const dateStr = `${Year}-${month}-${day}T${hour}:${minute}:00Z`;
    const parsed = new Date(dateStr);

    return isNaN(parsed.getTime()) ? null : parsed;
};

/**
 * Normalize array or single value to array
 */
const toArray = <T>(value: T | T[] | undefined): T[] => {
    if (value === undefined || value === null) return [];
    return Array.isArray(value) ? value : [value];
};

// ============================================================================
// Data Transformation Functions
// ============================================================================

/**
 * Extract PMID from various formats
 */
const extractPMID = (pmid: string | number | Record<string, any>): number => {
    if (typeof pmid === 'number') return pmid;
    if (typeof pmid === 'string') return parseInt(pmid, 10);
    // Handle XML parser output with attributes
    if (typeof pmid === 'object' && pmid !== null) {
        if (typeof pmid['#text'] === 'string') return parseInt(pmid['#text'], 10);
        if (typeof pmid['#text'] === 'number') return pmid['#text'];
    }
    throw new Error(`Invalid PMID format: ${JSON.stringify(pmid)}`);
};

/**
 * Transform MedlineCitation data to database format
 */
const transformMedlineCitation = (data: MedlineCitationData) => {
    const pmid = extractPMID(data.PMID);

    return {
        pmid,
        dateCompleted: parseMedlineDate(data.DateCompleted),
        dateRevised: parseMedlineDate(data.DateRevised) || new Date(),
        citationSubset: toArray(data.CitationSubset).join(','),
    };
};

/**
 * Transform Article data to database format
 */
const transformArticle = (pmid: number, data?: ArticleData) => {
    if (!data) return null;

    return {
        pmid,
        journal: data.Journal || {},
        articleTitle: data.ArticleTitle || '',
        pagination: data.Pagination || undefined,
        language: data.Language || null,
        publicationTypes: toArray(data.PublicationTypeList?.PublicationType),
    };
};

/**
 * Transform Author data to database format
 */
const transformAuthors = (articleId: number, authorList?: { Author?: AuthorData[] }) => {
    const authors = toArray(authorList?.Author);

    return authors.map(author => ({
        articleId,
        lastName: author.LastName || null,
        foreName: author.ForeName || null,
        initials: author.Initials || null,
        affiliation: author.Affiliation || null,
    }));
};

/**
 * Transform Grant data to database format
 */
const transformGrants = (articleId: number, grantList?: { Grant?: GrantData[] }) => {
    const grants = toArray(grantList?.Grant);

    return grants.map(grant => ({
        articleId,
        grantId: grant.GrantID ? String(grant.GrantID) : null,
        acronym: grant.Acronym || null,
        agency: grant.Agency || null,
        country: grant.Country || null,
    }));
};

/**
 * Transform MedlineJournalInfo data to database format
 */
const transformMedlineJournalInfo = (pmid: number, data?: MedlineJournalInfoData) => {
    if (!data) return null;

    return {
        pmid,
        country: data.Country || null,
        medlineTA: data.MedlineTA || null,
        nlmUniqueId: typeof data.NlmUniqueID === 'string' ? parseInt(data.NlmUniqueID, 10) : (data.NlmUniqueID || null),
        issnLinking: data.ISSNLinking || null,
    };
};

/**
 * Extract text value from various formats
 */
const extractText = (value: string | Record<string, any> | undefined): string => {
    if (typeof value === 'string') return value;
    if (typeof value === 'object' && value !== null) {
        if (typeof value['#text'] === 'string') return value['#text'];
    }
    return '';
};

/**
 * Transform Chemical data to database format
 */
const transformChemicals = (pmid: number, chemicalList?: { Chemical?: ChemicalData[] }) => {
    const chemicals = toArray(chemicalList?.Chemical);

    return chemicals.map(chemical => ({
        pmid,
        registryNumber: String(chemical.RegistryNumber || ''),
        nameOfSubstance: extractText(chemical.NameOfSubstance),
    }));
};

/**
 * Transform MeshHeading data to database format
 */
const transformMeshHeadings = (pmid: number, meshHeadingList?: { MeshHeading?: MeshHeadingData[] }) => {
    const meshHeadings = toArray(meshHeadingList?.MeshHeading);

    return meshHeadings.map(heading => ({
        pmid,
        descriptorName: extractText(heading.DescriptorName),
        qualifierNames: toArray(heading.QualifierName).map(q => extractText(q)),
    }));
};

/**
 * Transform PubMedData to database format
 */
const transformPubMedData = (pmid: number, data?: PubMedData) => {
    if (!data) return null;

    return {
        pmid,
        publicationStatus: data.PublicationStatus || null,
        articleIds: toArray(data.ArticleIdList?.ArticleId) as any,
        history: toArray(data.History?.PubMedPubDate) as any,
    };
};

// ============================================================================
// Sync Functions
// ============================================================================

/**
 * Sync a single PubmedArticle to the database
 * @param article - The PubmedArticle to sync
 * @param repository - The article repository instance
 * @returns Result of the sync operation
 */
const syncSingleArticle = async (
    article: PubmedArticle,
    repository: IArticleRepository
): Promise<SyncArticleResult> => {
    const medlineCitation = article.MedlineCitation;
    if (!medlineCitation) {
        return {
            pmid: 0,
            success: false,
            error: 'No MedlineCitation found',
        };
    }

    let pmid: number;
    try {
        pmid = extractPMID(medlineCitation.PMID);
    } catch (error) {
        return {
            pmid: 0,
            success: false,
            error: error instanceof Error ? error.message : String(error),
        };
    }

    try {
        // Transform all data
        const citationData = transformMedlineCitation(medlineCitation);
        const articleData = transformArticle(pmid, medlineCitation.Article);
        const authors = transformAuthors(0, medlineCitation.Article?.AuthorList); // articleId will be set by repository
        const grants = transformGrants(0, medlineCitation.Article?.GrantList); // articleId will be set by repository
        const journalInfoData = transformMedlineJournalInfo(pmid, medlineCitation.MedlineJournalInfo);
        const chemicals = transformChemicals(pmid, medlineCitation.ChemicalList);
        const meshHeadings = transformMeshHeadings(pmid, medlineCitation.MeshHeadingList);
        const pubmedData = transformPubMedData(pmid, article.PubmedData);

        // Use repository to sync all data
        return await repository.syncArticle(
            pmid,
            citationData,
            articleData,
            authors,
            grants,
            journalInfoData,
            chemicals,
            meshHeadings,
            pubmedData
        );
    } catch (error) {
        return {
            pmid,
            success: false,
            error: error instanceof Error ? error.message : String(error),
        };
    }
};

/**
 * Sync a single baseline file to the database
 * @param year - The year of the baseline file
 * @param fileName - The filename of the baseline file
 * @param repository - The article repository instance (optional, will create default if not provided)
 * @returns The parsed and synced articles
 */
export const syncFileToDb = async (
    year: string,
    fileName: string,
    repository?: IArticleRepository
) => {
    // Use provided repository or create default one
    const repo = repository ?? createArticleRepository(getPrismaClient());

    // Download and decompress the file
    const buffer = await downloadBaselineFile(fileName, year);
    const decompressed = (await gunzip(buffer)).toString('utf8');

    // Parse XML
    const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '@_',
    });
    const parsedResult = parser.parse(decompressed);

    // Get PubmedArticle array (handle both single object and array)
    let pubmedArticles: PubmedArticle[];
    const pubmedArticleSet = parsedResult['PubmedArticleSet'];
    const pubmedArticle = pubmedArticleSet?.['PubmedArticle'];

    if (Array.isArray(pubmedArticle)) {
        pubmedArticles = pubmedArticle;
    } else if (pubmedArticle) {
        pubmedArticles = [pubmedArticle];
    } else {
        pubmedArticles = [];
    }

    console.log(`Found ${pubmedArticles.length} articles in ${fileName}`);

    // Process each article
    const results: SyncArticleResult[] = [];
    const batchSize = 100;

    for (let i = 0; i < pubmedArticles.length; i += batchSize) {
        const batch = pubmedArticles.slice(i, i + batchSize);

        for (const article of batch) {
            const result = await syncSingleArticle(article, repo);

            // Skip articles without valid PMID
            if (result.pmid === 0 && !result.success) {
                console.error('Error syncing article:', result.error);
                continue;
            }

            results.push(result);

            if (result.success && results.length % 100 === 0) {
                console.log(`Synced ${results.filter(r => r.success).length}/${pubmedArticles.length} articles...`);
            }

            if (!result.success) {
                console.error(`Error syncing PMID ${result.pmid}:`, result.error);
            }
        }
    }

    console.log(`Completed syncing ${fileName}. Success: ${results.filter(r => r.success).length}, Failed: ${results.filter(r => !r.success).length}`);

    return results;
};

/**
 * Sync all baseline files for a given year to the database
 * @param year - The year to sync
 * @param repository - The article repository instance (optional, will create default if not provided)
 * @returns Summary of sync operation
 */
export const syncBaselineFileToDb = async (
    year: string,
    repository?: IArticleRepository
) => {
    const syncedFiles = await listSyncedBaselineFiles(year);
    console.log(`Found ${syncedFiles.length} files for year ${year}`);

    const summary = {
        totalFiles: syncedFiles.length,
        processedFiles: 0,
        totalArticles: 0,
        successArticles: 0,
        failedArticles: 0,
    };

    for (const fileName of syncedFiles) {
        console.log(`\nProcessing ${fileName}...`);
        try {
            const results = await syncFileToDb(year, fileName, repository);
            summary.processedFiles++;
            summary.totalArticles += results.length;
            summary.successArticles += results.filter(r => r.success).length;
            summary.failedArticles += results.filter(r => !r.success).length;
        } catch (error) {
            console.error(`Error processing ${fileName}:`, error);
        }
    }

    console.log('\n=== Sync Summary ===');
    console.log(`Total Files: ${summary.totalFiles}`);
    console.log(`Processed Files: ${summary.processedFiles}`);
    console.log(`Total Articles: ${summary.totalArticles}`);
    console.log(`Success: ${summary.successArticles}`);
    console.log(`Failed: ${summary.failedArticles}`);

    return summary;
};
