// ============================================================================
// Prisma Implementation
// ============================================================================

import { PrismaClient } from "../generated/prisma/client.js";
import { ArticleCreateData, ArticleDetailAffiliationCreateData, ArticleDetailAuthorAffiliationCreateData, ArticleDetailAuthorCreateData, ArticleDetailCreateData, ArticleDetailFullTextSourceCreateData, ArticleDetailJournalInfoCreateData, ArticleDetailKeywordCreateData, ArticleDetailMeshTermCreateData, ArticleDetailPublicationTypeCreateData, ArticleDetailReferenceCreateData, ArticleDetailRelatedInformationCreateData, ArticleDetailSimilarArticleCreateData, ArticleDetailSyncData, AuthorCreateData, ChemicalCreateData, GrantCreateData, IArticleRepository, MedlineCitationCreateData, MedlineJournalInfoCreateData, MeshHeadingCreateData, PubMedDataCreateData, SyncArticleResult } from "./article-repository.js";

/**
 * Prisma-based implementation of IArticleRepository
 */
export class PrismaArticleRepository implements IArticleRepository {
    constructor(private readonly prisma: PrismaClient) { }
    async isArticleExist(pmid: number): Promise<boolean> {
        const article = await this.prisma.article.findUnique({
            where: { pmid },
            select: { pmid: true },
        });
        return article !== null;
    }

    async findArticleWithoutAbstract(lastPmid: number, take: number = 100): Promise<number[]> {
        // Find articles that either:
        // 1. Have ArticleDetail but abstract is null
        // 2. Have Article but no ArticleDetail record yet

        // First, find ArticleDetail records with null abstract
        const detailsWithoutAbstract = await this.prisma.articleDetail.findMany({
            where: {
                pmid: {
                    gt: lastPmid,
                },
                abstract: {
                    equals: null,
                },
            },
            select: {
                pmid: true,
            },
            orderBy: {
                pmid: 'asc',
            },
            take,
        });

        const pmidsWithoutAbstract = new Set(detailsWithoutAbstract.map(a => a.pmid));

        // Second, find Articles that don't have ArticleDetail yet
        const articlesWithoutDetail = await this.prisma.article.findMany({
            where: {
                pmid: {
                    gt: lastPmid,
                },
                articleDetail: {
                    is: null,
                },
            },
            select: {
                pmid: true,
            },
            orderBy: {
                pmid: 'asc',
            },
            take,
        });

        // Combine both sets and sort
        const allPmids = new Set([
            ...pmidsWithoutAbstract,
            ...articlesWithoutDetail.map(a => a.pmid),
        ]);

        // Convert to sorted array
        const sortedPmids = Array.from(allPmids).sort((a, b) => a - b);

        // Return only the requested number of records
        return sortedPmids.slice(0, take);
    }

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


    async syncArticleDetail(data: ArticleDetailSyncData): Promise<SyncArticleResult> {
        const { detail, authors, affiliations, keywords, similarArticles, references, publicationTypes, meshTerms, relatedInformation, fullTextSources, journalInfo } = data;

        try {
            await this.prisma.$transaction(async (tx) => {
                // Upsert ArticleDetail
                const existingDetail = await tx.articleDetail.findUnique({
                    where: { pmid: detail.pmid },
                });

                let articleDetailId: number;
                if (existingDetail) {
                    await tx.articleDetail.update({
                        where: { pmid: detail.pmid },
                        data: {
                            doi: detail.doi,
                            title: detail.title,
                            abstract: detail.abstract,
                            conflictOfInterestStatement: detail.conflictOfInterestStatement,
                        },
                    });
                    articleDetailId = existingDetail.id;

                    // Delete existing related data
                    await tx.articleDetailAuthor.deleteMany({
                        where: { articleDetailId },
                    });
                    await tx.articleDetailAffiliation.deleteMany({
                        where: { articleDetailId },
                    });
                    await tx.articleDetailKeyword.deleteMany({
                        where: { articleDetailId },
                    });
                    await tx.articleDetailSimilarArticle.deleteMany({
                        where: { articleDetailId },
                    });
                    await tx.articleDetailReference.deleteMany({
                        where: { articleDetailId },
                    });
                    await tx.articleDetailPublicationType.deleteMany({
                        where: { articleDetailId },
                    });
                    await tx.articleDetailMeshTerm.deleteMany({
                        where: { articleDetailId },
                    });
                    await tx.articleDetailRelatedInformation.deleteMany({
                        where: { articleDetailId },
                    });
                    await tx.articleDetailFullTextSource.deleteMany({
                        where: { articleDetailId },
                    });
                } else {
                    const created = await tx.articleDetail.create({
                        data: {
                            pmid: detail.pmid,
                            doi: detail.doi,
                            title: detail.title,
                            abstract: detail.abstract,
                            conflictOfInterestStatement: detail.conflictOfInterestStatement,
                        },
                    });
                    articleDetailId = created.id;
                }

                // Create authors with their affiliations
                for (const author of authors) {
                    const createdAuthor = await tx.articleDetailAuthor.create({
                        data: {
                            articleDetailId,
                            name: author.name,
                            position: author.position,
                        },
                    });

                    // Create author affiliations
                    if (author.affiliations.length > 0) {
                        await tx.articleDetailAuthorAffiliation.createMany({
                            data: author.affiliations.map(aff => ({
                                authorId: createdAuthor.id,
                                institution: aff.institution,
                                city: aff.city,
                                country: aff.country,
                                email: aff.email,
                            })),
                            skipDuplicates: true,
                        });
                    }
                }

                // Create article-level affiliations
                if (affiliations.length > 0) {
                    await tx.articleDetailAffiliation.createMany({
                        data: affiliations.map(aff => ({
                            articleDetailId,
                            institution: aff.institution,
                            city: aff.city,
                            country: aff.country,
                            email: aff.email,
                        })),
                        skipDuplicates: true,
                    });
                }

                // Create keywords
                if (keywords.length > 0) {
                    await tx.articleDetailKeyword.createMany({
                        data: keywords.map(kw => ({
                            articleDetailId,
                            text: kw.text,
                            isMeSH: kw.isMeSH ?? false,
                        })),
                        skipDuplicates: true,
                    });
                }

                // Create similar articles
                if (similarArticles.length > 0) {
                    await tx.articleDetailSimilarArticle.createMany({
                        data: similarArticles.map(sa => ({
                            articleDetailId,
                            pmid: sa.pmid,
                            title: sa.title,
                        })),
                        skipDuplicates: true,
                    });
                }

                // Create references
                if (references.length > 0) {
                    await tx.articleDetailReference.createMany({
                        data: references.map(ref => ({
                            articleDetailId,
                            pmid: ref.pmid,
                            citation: ref.citation,
                        })),
                        skipDuplicates: true,
                    });
                }

                // Create publication types
                if (publicationTypes.length > 0) {
                    await tx.articleDetailPublicationType.createMany({
                        data: publicationTypes.map(pt => ({
                            articleDetailId,
                            type: pt.type,
                        })),
                        skipDuplicates: true,
                    });
                }

                // Create MeSH terms
                if (meshTerms.length > 0) {
                    await tx.articleDetailMeshTerm.createMany({
                        data: meshTerms.map(mt => ({
                            articleDetailId,
                            text: mt.text,
                            isMeSH: mt.isMeSH ?? true,
                        })),
                        skipDuplicates: true,
                    });
                }

                // Create related information
                if (relatedInformation.length > 0) {
                    await tx.articleDetailRelatedInformation.createMany({
                        data: relatedInformation.map(ri => ({
                            articleDetailId,
                            category: ri.category,
                            text: ri.text,
                            url: ri.url,
                        })),
                        skipDuplicates: true,
                    });
                }

                // Create full text sources
                if (fullTextSources.length > 0) {
                    await tx.articleDetailFullTextSource.createMany({
                        data: fullTextSources.map(ft => ({
                            articleDetailId,
                            name: ft.name,
                            url: ft.url,
                            type: ft.type,
                        })),
                        skipDuplicates: true,
                    });
                }

                // Upsert journal info
                if (journalInfo) {
                    await tx.articleDetailJournalInfo.upsert({
                        where: { articleDetailId },
                        create: {
                            articleDetailId,
                            title: journalInfo.title,
                            volume: journalInfo.volume,
                            issue: journalInfo.issue,
                            pages: journalInfo.pages,
                            pubDate: journalInfo.pubDate,
                        },
                        update: {
                            title: journalInfo.title,
                            volume: journalInfo.volume,
                            issue: journalInfo.issue,
                            pages: journalInfo.pages,
                            pubDate: journalInfo.pubDate,
                        },
                    });
                }
            });

            return {
                pmid: detail.pmid,
                success: true,
            };
        } catch (error) {
            return {
                pmid: detail.pmid,
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }

    async getSyncedBaselineFiles(fileNames: string[]): Promise<Set<string>> {
        const existingSyncs = await this.prisma.baselineSync.findMany({
            where: {
                fileName: { in: fileNames },
                status: 'completed',
            },
            select: {
                fileName: true,
            },
        });
        return new Set(existingSyncs.map(s => s.fileName));
    }

    async markBaselineFileInProgress(fileName: string, fileDate: string): Promise<void> {
        await this.prisma.baselineSync.upsert({
            where: { fileName },
            update: { status: 'in_progress', errorMessage: null },
            create: {
                fileName,
                fileDate,
                recordsCount: 0,
                status: 'in_progress',
            },
        });
    }

    async markBaselineFileCompleted(fileName: string, fileDate: string, recordsCount: number): Promise<void> {
        await this.prisma.baselineSync.upsert({
            where: { fileName },
            update: {
                status: 'completed',
                recordsCount,
                errorMessage: null,
            },
            create: {
                fileName,
                fileDate,
                recordsCount,
                status: 'completed',
            },
        });
    }

    async markBaselineFileFailed(fileName: string, fileDate: string, errorMessage: string): Promise<void> {
        await this.prisma.baselineSync.upsert({
            where: { fileName },
            update: {
                status: 'failed',
                errorMessage,
            },
            create: {
                fileName,
                fileDate,
                recordsCount: 0,
                status: 'failed',
                errorMessage,
            },
        });
    }
}