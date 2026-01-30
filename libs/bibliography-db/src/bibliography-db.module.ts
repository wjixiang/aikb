import { Module, Global } from '@nestjs/common';
import { BibliographyDBPrismaService } from './prisma';

@Global()
@Module({
    providers: [BibliographyDBPrismaService],
    exports: [BibliographyDBPrismaService],
})
export class BibliographyDBModule { }
