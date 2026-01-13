
/*
 * -------------------------------------------------------
 * THIS FILE WAS AUTOMATICALLY GENERATED (DO NOT MODIFY)
 * -------------------------------------------------------
 */

/* tslint:disable */
/* eslint-disable */

export class SemanticSearchFilters {
    tags?: Nullable<string[]>;
    collections?: Nullable<string[]>;
    authors?: Nullable<string[]>;
    publicationYear?: Nullable<IntRange>;
}

export class IntRange {
    min?: Nullable<number>;
    max?: Nullable<number>;
}

export class RegisterPdfUploadUrlRequest {
    fileName: string;
}

export class ChunkingConfigInput {
    strategy: string;
}

export class EmbeddingConfigInput {
    model: string;
    dimension: number;
    batchSize: number;
    maxRetries: number;
    timeout: number;
    provider: string;
    concurrencyLimit: number;
}

export class CreateChunkEmbedGroupInput {
    itemId: string;
    name?: Nullable<string>;
    description?: Nullable<string>;
    chunkingConfig?: Nullable<ChunkingConfigInput>;
    embeddingConfig?: Nullable<EmbeddingConfigInput>;
    isDefault?: Nullable<boolean>;
    isActive?: Nullable<boolean>;
    createdBy?: Nullable<string>;
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
    evidenceType: string;
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
    concurrencyLimit: number;
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

export class SemanticSearchResultChunk {
    chunkId: string;
    itemId: string;
    title?: Nullable<string>;
    content: string;
    score: number;
    metadata?: Nullable<ChunkMetadata>;
    libraryItem?: Nullable<LibraryItemMetadata>;
    chunkEmbedGroup?: Nullable<ChunkEmbedGroup>;
}

export class ChunkMetadata {
    startPosition?: Nullable<number>;
    endPosition?: Nullable<number>;
    wordCount?: Nullable<number>;
    chunkType?: Nullable<string>;
}

export class SemanticSearchResult {
    query: string;
    totalResults: number;
    results: SemanticSearchResultChunk[];
}

export abstract class IQuery {
    abstract libraryItems(): LibraryItemMetadata[] | Promise<LibraryItemMetadata[]>;

    abstract libraryItem(id: string): Nullable<LibraryItemMetadata> | Promise<Nullable<LibraryItemMetadata>>;

    abstract itemArchives(itemId: string): ItemArchive[] | Promise<ItemArchive[]>;

    abstract chunkEmbedGroups(itemId: string): Nullable<Nullable<ChunkEmbedGroups>[]> | Promise<Nullable<Nullable<ChunkEmbedGroups>[]>>;

    abstract signedUploadUrl(request: RegisterPdfUploadUrlRequest): Nullable<SignedS3UploadResult> | Promise<Nullable<SignedS3UploadResult>>;

    abstract semanticSearch(query: string, chunkEmbedGroupId: string, topK?: Nullable<number>, scoreThreshold?: Nullable<number>, filters?: Nullable<SemanticSearchFilters>): Nullable<SemanticSearchResult> | Promise<Nullable<SemanticSearchResult>>;
}

export abstract class IMutation {
    abstract createLibraryItem(title: string): Nullable<LibraryItemMetadata> | Promise<Nullable<LibraryItemMetadata>>;

    abstract createChunkEmbedGroup(input: CreateChunkEmbedGroupInput): Nullable<ChunkEmbedGroup> | Promise<Nullable<ChunkEmbedGroup>>;
}

type Nullable<T> = T | null;
