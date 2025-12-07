
/*
 * -------------------------------------------------------
 * THIS FILE WAS AUTOMATICALLY GENERATED (DO NOT MODIFY)
 * -------------------------------------------------------
 */

/* tslint:disable */
/* eslint-disable */

export interface RegisterPdfUploadUrlRequest {
    fileName: string;
}

export interface Author {
    firstName: string;
    lastName: string;
    middleName?: Nullable<string>;
}

export interface ItemArchive {
    fileType: string;
    fileSize: number;
    fileHash: string;
    addDate: string;
    s3Key: string;
    pageCount: number;
    wordCount?: Nullable<number>;
}

export interface LibraryItemMetadata {
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
}

export interface SignedS3UploadResult {
    uploadUrl: string;
    s3Key: string;
    expiresAt: string;
}

export interface ChunkEmbedConfig {
    chunkingConfig: ChunkingConfig;
    embeddingConfig: EmbeddingConfig;
}

export interface ChunkingConfig {
    strategy: string;
}

export interface EmbeddingConfig {
    model: string;
    dimension: number;
    batchSize: number;
    maxRetries: number;
    timeout: number;
    provider: string;
}

export interface ChunkEmbedGroup {
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

export interface ChunkEmbedGroups {
    groups: ChunkEmbedGroup[];
    total: number;
}

export interface IQuery {
    libraryItems(): LibraryItemMetadata[] | Promise<LibraryItemMetadata[]>;
    itemArchives(itemId: string): ItemArchive[] | Promise<ItemArchive[]>;
    signedUploadUrl(request: RegisterPdfUploadUrlRequest): Nullable<SignedS3UploadResult> | Promise<Nullable<SignedS3UploadResult>>;
}

export interface IMutation {
    createLibraryItem(title: string): Nullable<LibraryItemMetadata> | Promise<Nullable<LibraryItemMetadata>>;
}

type Nullable<T> = T | null;
