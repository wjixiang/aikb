
/*
 * -------------------------------------------------------
 * THIS FILE WAS AUTOMATICALLY GENERATED (DO NOT MODIFY)
 * -------------------------------------------------------
 */

/* tslint:disable */
/* eslint-disable */

export class Author {
    id: string;
    name: string;
    email?: Nullable<string>;
    affiliation?: Nullable<string>;
    createdAt: DateTime;
    updatedAt: DateTime;
}

export class Article {
    id: string;
    title: string;
    abstract?: Nullable<string>;
    content?: Nullable<string>;
    doi?: Nullable<string>;
    pmid?: Nullable<string>;
    publishedDate?: Nullable<DateTime>;
    authors: Author[];
    createdAt: DateTime;
    updatedAt: DateTime;
}

export abstract class IQuery {
    abstract articles(limit?: Nullable<number>, offset?: Nullable<number>): Article[] | Promise<Article[]>;

    abstract article(id: string): Nullable<Article> | Promise<Nullable<Article>>;

    abstract articleByPMID(pmid: string): Nullable<Article> | Promise<Nullable<Article>>;

    abstract searchArticles(query: string, limit?: Nullable<number>): Article[] | Promise<Article[]>;

    abstract authors(): Author[] | Promise<Author[]>;

    abstract author(id: string): Nullable<Author> | Promise<Nullable<Author>>;
}

export abstract class IMutation {
    abstract createArticle(title: string, abstract?: Nullable<string>, content?: Nullable<string>, doi?: Nullable<string>, pmid?: Nullable<string>, publishedDate?: Nullable<DateTime>, authorIds?: Nullable<string[]>): Article | Promise<Article>;

    abstract updateArticle(id: string, title?: Nullable<string>, abstract?: Nullable<string>, content?: Nullable<string>, doi?: Nullable<string>, pmid?: Nullable<string>, publishedDate?: Nullable<DateTime>): Article | Promise<Article>;

    abstract deleteArticle(id: string): boolean | Promise<boolean>;
}

export type DateTime = any;
type Nullable<T> = T | null;
