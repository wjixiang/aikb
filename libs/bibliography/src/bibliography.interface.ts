import { ModuleMetadata } from '@nestjs/common';
import { PrismaClient } from 'bibliography-db';
import { S3ServiceConfig } from '@aikb/s3-service';
import { Type } from '@nestjs/common';

export interface BibliographyModuleOptions {
    prisma: PrismaClient;
    s3ServiceConfig: S3ServiceConfig;
}

export interface BibliographyModuleAsyncOptions
    extends Pick<ModuleMetadata, 'imports'> {
    useExisting?: Type<BibliographyModuleOptions> | string;
    useClass?: Type<BibliographyModuleOptions>;
    useFactory?: (...args: any[]) => Promise<BibliographyModuleOptions> | BibliographyModuleOptions;
    inject?: any[];
}
