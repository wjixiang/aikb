// ============================================================================
// Prisma Implementation
// ============================================================================

import { PrismaClient } from "../generated/prisma/client.js";
import { ArticleCreateData, AuthorCreateData, ChemicalCreateData, GrantCreateData, IArticleRepository, MedlineCitationCreateData, MedlineJournalInfoCreateData, MeshHeadingCreateData, PubMedDataCreateData, SyncArticleResult } from "./article-repository.js";

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
                // Find or create Journal first (needed for Article)
                let journalId: number | null = null;
                if (journalInfoData) {
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
                                    title: journalInfoData.title,
                                    ISOAbbreviation: journalInfoData.ISOAbbreviation
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
                    }
                }

                if (!journalId) throw new Error('Sync article failed: cannot indentify journal infomation')

                // Upsert MedlineCitation
                await tx.medlineCitation.upsert({
                    where: { pmid },
                    create: { ...citationData, journalId: journalId },
                    update: citationData,
                });



                // Upsert Article (now that we have journalId)
                if (articleData && journalId !== null) {
                    const existingArticle = await tx.article.findUnique({
                        where: { pmid },
                    });

                    let articleId: number;
                    if (existingArticle) {
                        await tx.article.update({
                            where: { pmid },
                            data: {
                                ...articleData,
                                journalId,
                            },
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
                            data: {
                                ...articleData,
                                journalId,
                            },
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