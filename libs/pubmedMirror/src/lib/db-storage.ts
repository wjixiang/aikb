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
    MedlineJournalInfoCreateData,
    type SyncArticleResult,
} from './article-repository.js';


const gunzip = promisify(zlib.gunzip);

// ============================================================================
// Dependency Interfaces (按职责分层)
// ============================================================================

/**
 * OSS-related dependencies
 */
export interface OSSDependencies {
    downloadFile: (fileName: string, year: string) => Promise<Buffer>;
    listFiles: (year: string) => Promise<string[]>;
}

/**
 * XML 解析相关依赖
 */
export interface XMLDependencies {
    decompress: (buffer: Buffer) => Promise<Buffer>;
    parse: (xml: string) => any;
}

/**
 * Gunzip function type
 */
type GunzipFunction = (buffer: Buffer) => Promise<Buffer>;

/**
 * Completed syncing dependencies
 */
export interface SyncDependencies {
    oss: OSSDependencies;
    xml: XMLDependencies;
}

/**
 * 默认依赖实现（生产环境使用）
 */
export const defaultDependencies: SyncDependencies = {
    oss: {
        downloadFile: downloadBaselineFile,
        listFiles: listSyncedBaselineFiles,
    },
    xml: {
        decompress: gunzip as GunzipFunction,
        parse: (xml: string) => {
            const parser = new XMLParser({
                ignoreAttributes: false,
                attributeNamePrefix: '@_',
            });
            return parser.parse(xml);
        },
    },
};

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
    MedlineJournalInfo?: MedlineJournalInfo;
    ChemicalList?: { Chemical?: ChemicalData[] };
    CitationSubset?: string | string[];
    MeshHeadingList?: { MeshHeading?: MeshHeadingData[] };
}

// Same as original data structure
interface MedlineJournalInfo {
    Country: string;
    MedlineTA: string;
    NlmUniqueID: number;
    ISSNLinking: string;
}

// Article > Journal structure
interface ArticleJournal {
    ISSN?: string | { '#text'?: string; '@_IssnType'?: string };
    JournalIssue?: Record<string, any>;
    Title?: string;
    ISOAbbreviation?: string;
}

interface ArticleData {
    Journal?: ArticleJournal | Record<string, any>;
    ArticleTitle?: string;
    Pagination?: {
        MedlinePgn: string | number;
    };
    AuthorList?: { Author?: AuthorData[] };
    Language?: string | string[];
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

// interface JournalInfo {
//     Country?: string;
//     MedlineTA?: string;
//     NlmUniqueID?: string | number;
//     ISSNLinking?: string;
// }

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
 * Note: journalId will be set by the repository after journal is created/looked up
 */
const transformArticle = (pmid: number, data?: ArticleData) => {
    if (!data) return null;

    // Handle language - can be string or array of strings
    let language: string | null = null;
    if (data.Language) {
        if (Array.isArray(data.Language)) {
            // Join multiple languages with comma, or take first one
            language = data.Language.length > 0 ? data.Language.join(', ') : null;
        } else {
            language = data.Language;
        }
    }

    // Handle pagination - can be string, number, or object with #text
    let pagination: string | undefined = undefined;
    if (data.Pagination?.MedlinePgn) {
        const pgnValue = data.Pagination.MedlinePgn;
        if (typeof pgnValue === 'string') {
            pagination = pgnValue;
        } else if (typeof pgnValue === 'number') {
            pagination = pgnValue.toString();
        } else if (typeof pgnValue === 'object' && pgnValue !== null) {
            pagination = extractText(pgnValue);
        }
    }

    return {
        pmid,
        journalId: 0, // Will be set by repository after journal is created/looked up
        articleTitle: extractText(data.ArticleTitle) || '',
        pagination,
        language,
        publicationTypes: toArray(data.PublicationTypeList?.PublicationType).map(pt => extractText(pt)),
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
 * Transform MedlineJournalInfo data to database format
 * Combines data from both MedlineJournalInfo and Article > Journal
 */
const transformMedlineJournalInfo = (
    pmid: number,
    medlineJournalInfo?: MedlineJournalInfo,
    articleJournal?: ArticleJournal | Record<string, any>
): MedlineJournalInfoCreateData | null => {
    if (!medlineJournalInfo && !articleJournal) return null;

    // Extract ISSN from Article > Journal (can be string or object with #text)
    let articleIssn: string | null = null;
    if (articleJournal?.ISSN) {
        const issnValue = articleJournal.ISSN;
        if (typeof issnValue === 'string') {
            articleIssn = issnValue;
        } else if (typeof issnValue === 'object' && issnValue !== null) {
            articleIssn = extractText(issnValue);
        }
    }

    // Extract Title from Article > Journal
    const articleTitle = articleJournal?.Title ? extractText(articleJournal.Title) : null;

    // Extract ISOAbbreviation from Article > Journal
    const articleISOAbbreviation = articleJournal?.ISOAbbreviation ? extractText(articleJournal.ISOAbbreviation) : null;

    // Parse NlmUniqueID from MedlineJournalInfo
    let nlmUniqueId: number | null = null;
    if (medlineJournalInfo?.NlmUniqueID) {
        if (typeof medlineJournalInfo.NlmUniqueID === 'number') {
            nlmUniqueId = medlineJournalInfo.NlmUniqueID;
        } else if (typeof medlineJournalInfo.NlmUniqueID === 'string') {
            const parsed = parseInt(medlineJournalInfo.NlmUniqueID, 10);
            if (!isNaN(parsed)) {
                nlmUniqueId = parsed;
            }
        }
    }

    return {
        pmid,
        country: medlineJournalInfo?.Country || null,
        title: articleTitle || null,
        ISOAbbreviation: articleISOAbbreviation || null,
        medlineTA: medlineJournalInfo?.MedlineTA || null,
        nlmUniqueId: nlmUniqueId,
        issnLinking: medlineJournalInfo?.ISSNLinking || articleIssn || null,
    };
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
 * Data transformation dependencies for syncSingleArticle
 */
export interface DataTransformDependencies {
    extractPMID: (input: string | number | Record<string, any>) => number;
    transformMedlineCitation: (data: MedlineCitationData) => {
        pmid: number;
        dateCompleted: Date | null;
        dateRevised: Date;
        citationSubset: string;
    };
    transformArticle: (pmid: number, data?: ArticleData) => {
        pmid: number;
        journalId: number;
        articleTitle: string;
        pagination: string | undefined;
        language: string | null;
        publicationTypes: string[];
    } | null;
    transformAuthors: (articleId: number, authorList?: { Author?: AuthorData[] }) => Array<{
        articleId: number;
        lastName: string | null;
        foreName: string | null;
        initials: string | null;
        affiliation: string | null;
    }>;
    transformGrants: (articleId: number, grantList?: { Grant?: GrantData[] }) => Array<{
        articleId: number;
        grantId: string | null;
        acronym: string | null;
        agency: string | null;
        country: string | null;
    }>;
    /** Combine jounral infomation from `MedlineJournalInfo` and `Article > Journal` */
    transformMedlineJournalInfo: (
        pmid: number,
        medlineJournalInfo?: MedlineJournalInfo,
        articleJournal?: ArticleJournal | Record<string, any>
    ) => MedlineJournalInfoCreateData | null;
    transformChemicals: (pmid: number, chemicalList?: { Chemical?: ChemicalData[] }) => Array<{
        pmid: number;
        registryNumber: string;
        nameOfSubstance: string;
    }>;
    transformMeshHeadings: (pmid: number, meshHeadingList?: { MeshHeading?: MeshHeadingData[] }) => Array<{
        pmid: number;
        descriptorName: string;
        qualifierNames: string[];
    }>;
    transformPubMedData: (pmid: number, data?: PubMedData) => {
        pmid: number;
        publicationStatus: string | null;
        articleIds: any;
        history: any;
    } | null;
}

/**
 * Default data transformation dependencies
 */
export const defaultDataTransformDependencies: DataTransformDependencies = {
    extractPMID,
    transformMedlineCitation,
    transformArticle,
    transformAuthors,
    transformGrants,
    transformMedlineJournalInfo,
    transformChemicals,
    transformMeshHeadings,
    transformPubMedData,
};

/**
 * Sync a single PubmedArticle to the database
 * @param article - The PubmedArticle to sync
 * @param repository - The article repository instance
 * @param deps - Data transformation dependencies (optional, uses default if not provided)
 * @returns Result of the sync operation
 */
export const syncSingleArticle = async (
    article: PubmedArticle,
    repository: IArticleRepository,
    deps: DataTransformDependencies = defaultDataTransformDependencies
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
        pmid = deps.extractPMID(medlineCitation.PMID);
    } catch (error) {
        return {
            pmid: 0,
            success: false,
            error: error instanceof Error ? error.message : String(error),
        };
    }

    try {
        // Transform all data using injected dependencies
        const citationData = deps.transformMedlineCitation(medlineCitation);
        const articleData = deps.transformArticle(pmid, medlineCitation.Article);
        const authors = deps.transformAuthors(0, medlineCitation.Article?.AuthorList); // articleId will be set by repository
        const grants = deps.transformGrants(0, medlineCitation.Article?.GrantList); // articleId will be set by repository
        const journalInfoData = deps.transformMedlineJournalInfo(
            pmid,
            medlineCitation.MedlineJournalInfo,
            medlineCitation.Article?.Journal
        );
        const chemicals = deps.transformChemicals(pmid, medlineCitation.ChemicalList);
        const meshHeadings = deps.transformMeshHeadings(pmid, medlineCitation.MeshHeadingList);
        const pubmedData = deps.transformPubMedData(pmid, article.PubmedData);

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
 * @param dependencies - The dependencies for OSS and XML operations (optional, uses default if not provided)
 * @returns The parsed and synced articles
 */
export const syncFileToDb = async (
    year: string,
    fileName: string,
    repository?: IArticleRepository,
    dependencies: SyncDependencies = defaultDependencies
): Promise<SyncArticleResult[]> => {
    // Use provided repository or create default one
    const repo = repository ?? createArticleRepository(getPrismaClient());

    // Download and decompress the file using injected dependencies
    const buffer = await dependencies.oss.downloadFile(fileName, year);
    const decompressed = (await dependencies.xml.decompress(buffer)).toString('utf8');

    // Parse XML using injected dependencies
    const parsedResult = dependencies.xml.parse(decompressed);

    // Get PubmedArticle array (handle both single object and array)
    let pubmedArticles: PubmedArticle[];
    const pubmedArticleSet = parsedResult['PubmedArticleSet'];
    const pubmedArticle = pubmedArticleSet?.['PubmedArticle'];
    // writeFileSync(__dirname + '/pubmedArticle1.json', JSON.stringify(pubmedArticle[0], null, 2))

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
            const result = await syncSingleArticle(article, repo, defaultDataTransformDependencies);

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
 * @param dependencies - The dependencies for OSS and XML operations (optional, uses default if not provided)
 * @returns Summary of sync operation
 */
export const syncBaselineFileToDb = async (
    year: string,
    repository?: IArticleRepository,
    dependencies: SyncDependencies = defaultDependencies
) => {
    const syncedFiles = await dependencies.oss.listFiles(year);
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
            const results = await syncFileToDb(year, fileName, repository, dependencies);
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
