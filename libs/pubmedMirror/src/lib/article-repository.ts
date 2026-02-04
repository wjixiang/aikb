import { PrismaClient } from '../generated/prisma/client.js';

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
}

/**
 * Transformed data for Article
 */
export interface ArticleCreateData {
    pmid: number;
    journal: Record<string, any>;
    articleTitle: string;
    pagination?: { MedlinePgn?: string };
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
    medlineTA: string | null;
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
// Prisma Implementation
// ============================================================================

/**
 * Prisma-based implementation of IArticleRepository
 */
export class PrismaArticleRepository implements IArticleRepository {
    constructor(private readonly prisma: PrismaClient) { }

    async syncArticle(
        pmid: number,
        citationData: MedlineCitationCreateData,
        articleData: ArticleCreateData | null,
        authors: AuthorCreateData[],
        grants: GrantCreateData[],
        journalInfoData: MedlineJournalInfoCreateData | null,
        chemicals: ChemicalCreateData[],
        meshHeadings: MeshHeadingCreateData[],
        pubmedData: PubMedDataCreateData | null
    ): Promise<SyncArticleResult> {
        try {
            await this.prisma.$transaction(async (tx) => {
                // Upsert MedlineCitation
                await tx.medlineCitation.upsert({
                    where: { pmid },
                    create: citationData,
                    update: citationData,
                });

                // Upsert Article
                if (articleData) {
                    const existingArticle = await tx.article.findUnique({
                        where: { pmid },
                    });

                    let articleId: number;
                    if (existingArticle) {
                        await tx.article.update({
                            where: { pmid },
                            data: articleData,
                        });

                        // Delete and recreate authors and grants
                        await tx.author.deleteMany({
                            where: { articleId: existingArticle.id },
                        });
                        await tx.grant.deleteMany({
                            where: { articleId: existingArticle.id },
                        });
                        articleId = existingArticle.id;
                    } else {
                        const created = await tx.article.create({
                            data: articleData,
                        });
                        articleId = created.id;
                    }

                    // Create authors with correct articleId
                    if (authors.length > 0) {
                        const authorsWithCorrectId = authors.map(author => ({
                            ...author,
                            articleId,
                        }));
                        await tx.author.createMany({
                            data: authorsWithCorrectId,
                            skipDuplicates: true,
                        });
                    }

                    // Create grants with correct articleId
                    if (grants.length > 0) {
                        const grantsWithCorrectId = grants.map(grant => ({
                            ...grant,
                            articleId,
                        }));
                        await tx.grant.createMany({
                            data: grantsWithCorrectId,
                            skipDuplicates: true,
                        });
                    }
                }

                // Upsert MedlineJournalInfo
                if (journalInfoData) {
                    // Find or create Journal
                    let journalId: number;

                    if (journalInfoData.nlmUniqueId !== null) {
                        // Try to find existing journal by nlmUniqueId
                        const existingJournal = await tx.journal.findUnique({
                            where: { nlmUniqueId: journalInfoData.nlmUniqueId },
                        });

                        if (existingJournal) {
                            journalId = existingJournal.id;
                        } else {
                            // Create new journal with nlmUniqueId
                            const newJournal = await tx.journal.create({
                                data: {
                                    country: journalInfoData.country,
                                    medlineTA: journalInfoData.medlineTA ?? '',
                                    nlmUniqueId: journalInfoData.nlmUniqueId,
                                    issnLinking: journalInfoData.issnLinking,
                                },
                            });
                            journalId = newJournal.id;
                        }
                    } else if (journalInfoData.medlineTA !== null) {
                        // If nlmUniqueId is null, try to find by medlineTA
                        const journalsByTA = await tx.journal.findMany({
                            where: { medlineTA: journalInfoData.medlineTA },
                        });

                        if (journalsByTA.length > 0) {
                            // Use the first matching journal
                            journalId = journalsByTA[0].id;
                        } else {
                            // Generate a unique negative ID for journals without nlmUniqueId
                            // This ensures uniqueness while allowing creation
                            const generatedNlmUniqueId = -Math.abs(
                                journalInfoData.medlineTA.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
                            );

                            const newJournal = await tx.journal.create({
                                data: {
                                    country: journalInfoData.country,
                                    medlineTA: journalInfoData.medlineTA,
                                    nlmUniqueId: generatedNlmUniqueId,
                                    issnLinking: journalInfoData.issnLinking,
                                },
                            });
                            journalId = newJournal.id;
                        }
                    } else {
                        // Skip MedlineJournalInfo creation if both nlmUniqueId and medlineTA are null
                        return;
                    }

                    // Upsert MedlineJournalInfo with journalId
                    await tx.medlineJournalInfo.upsert({
                        where: { pmid },
                        create: {
                            pmid: journalInfoData.pmid,
                            journalId,
                        },
                        update: {
                            journalId,
                        },
                    });
                }

                // Delete and recreate chemicals
                await tx.chemical.deleteMany({ where: { pmid } });
                if (chemicals.length > 0) {
                    await tx.chemical.createMany({
                        data: chemicals,
                        skipDuplicates: true,
                    });
                }

                // Delete and recreate mesh headings
                await tx.meshHeading.deleteMany({ where: { pmid } });
                if (meshHeadings.length > 0) {
                    await tx.meshHeading.createMany({
                        data: meshHeadings,
                        skipDuplicates: true,
                    });
                }

                // Upsert PubMedData
                if (pubmedData) {
                    await tx.pubMedData.upsert({
                        where: { pmid },
                        create: pubmedData,
                        update: pubmedData,
                    });
                }
            });

            return {
                pmid,
                success: true,
            };
        } catch (error) {
            return {
                pmid,
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }
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
