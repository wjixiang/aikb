
/*
 * -------------------------------------------------------
 * THIS FILE WAS AUTOMATICALLY GENERATED (DO NOT MODIFY)
 * -------------------------------------------------------
 */

/* tslint:disable */
/* eslint-disable */

export class RegisterPdfUploadUrlRequest {
    fileName: string;
}

export class Author {
    firstName: string;
    lastName: string;
    middleName?: Nullable<string>;
}

export class ItemArchive {
    fileType: string;
    fileSize: number;
    fileHash: string;
    addDate: string;
    s3Key: string;
    pageCount: number;
    wordCount?: Nullable<number>;
}

export class LibraryItemMetadata {
    id: string;
    title: string;
    authors: Author[];
    abstract?: Nullable<string>;
    publicationYear?: Nullable<number>;
    publisher?: Nullable<string>;
    isbn?: Nullable<string>;
    doi?: Nullable<string>;
    url?: Nullable<string>;
    tags: string[];
    notes?: Nullable<string>;
    collections: string[];
    dateAdded: string;
    dateModified: string;
    language?: Nullable<string>;
    markdownContent?: Nullable<string>;
    markdownUpdatedDate?: Nullable<string>;
    archives?: Nullable<Nullable<ItemArchive>[]>;
    chunkEmbedGroups?: Nullable<ChunkEmbedGroups>;
}

export class SignedS3UploadResult {
    uploadUrl: string;
    s3Key: string;
    expiresAt: string;
}

export class ChunkEmbedConfig {
    chunkingConfig: ChunkingConfig;
    embeddingConfig: EmbeddingConfig;
}

export class ChunkingConfig {
    strategy: string;
}

export class EmbeddingConfig {
    model: string;
    dimension: number;
    batchSize: number;
    maxRetries: number;
    timeout: number;
    provider: string;
}

export class ChunkEmbedGroup {
    id: string;
    itemId: string;
    name?: Nullable<string>;
    description?: Nullable<string>;
    chunkEmbedConfig: ChunkEmbedConfig;
    isDefault?: Nullable<boolean>;
    isActive?: Nullable<boolean>;
    createdAt?: Nullable<string>;
    updatedAt?: Nullable<string>;
    createdBy?: Nullable<string>;
}

export class ChunkEmbedGroups {
    groups: ChunkEmbedGroup[];
    total: number;
}

export abstract class IQuery {
    abstract libraryItems(): LibraryItemMetadata[] | Promise<LibraryItemMetadata[]>;

    abstract itemArchives(itemId: string): ItemArchive[] | Promise<ItemArchive[]>;

    abstract signedUploadUrl(request: RegisterPdfUploadUrlRequest): Nullable<SignedS3UploadResult> | Promise<Nullable<SignedS3UploadResult>>;
}

export abstract class IMutation {
    abstract createLibraryItem(title: string): Nullable<LibraryItemMetadata> | Promise<Nullable<LibraryItemMetadata>>;
}

type Nullable<T> = T | null;
