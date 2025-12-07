
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

export interface LibraryItemMetadata {
    id: string;
    title: string;
}

export interface IQuery {
    items(): Nullable<Nullable<LibraryItemMetadata>[]> | Promise<Nullable<Nullable<LibraryItemMetadata>[]>>;
    upload_url(request: RegisterPdfUploadUrlRequest): Nullable<string> | Promise<Nullable<string>>;
}

export interface IMutation {
    addItem(title: string): Nullable<LibraryItemMetadata> | Promise<Nullable<LibraryItemMetadata>>;
}

type Nullable<T> = T | null;
