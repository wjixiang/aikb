import { prisma, BibliographyDBPrismaService } from './prisma';
import { BibliographyDBModule } from './bibliography-db.module';

export { PrismaClient, Prisma } from './generated/prisma/client';
export * from './generated/prisma/models';
export { prisma, BibliographyDBPrismaService, BibliographyDBModule };
