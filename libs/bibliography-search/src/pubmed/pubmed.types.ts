// Type definitions for PubMed search functionality

export type FieldConstraint =
    | "All Fields"
    | "Affiliation"
    | "Author"
    | "Author - Corporate"
    | "Author - First"
    | "Author - Identifier"
    | "Author - Last"
    | "Book"
    | "Conflict of Interest Statements"
    | "Date - Completion"
    | "Date - Create"
    | "Date - Entry"
    | "Date - MeSH"
    | "Date - Modification"
    | "Date - Publication"
    | "EC/RN Number"
    | "Editor"
    | "Filter"
    | "Grants and Funding"
    | "ISBN"
    | "Investigator"
    | "Issue"
    | "Journal"
    | "Language"
    | "Location ID"
    | "MeSH Major Topic"
    | "MeSH Subheading"
    | "MeSH Terms"
    | "Other Term"
    | "Pagination"
    | "Pharmacological Action"
    | "Publication Type"
    | "Publisher"
    | "Secondary Source ID"
    | "Subject - Personal Name"
    | "Supplementary Concept"
    | "Text Word"
    | "Title"
    | "Title/Abstract"
    | "Transliterated Title"
    | "Volume"

export interface RetrivalStrategy {
    term: string;
    field: FieldConstraint[]; // OR relation
    AND: RetrivalStrategy[] | null;
    OR: RetrivalStrategy[] | null;
    NOT: RetrivalStrategy[] | null;
}

export interface PubmedSearchParams {
    term: string;
    sort: 'match' | 'date' | 'pubdate' | 'fauth' | 'jour';
    sortOrder: 'asc' | 'dsc';
    filter: string[];
    page: number | null;
}

export interface ArticleProfile {
    doi: string | null;
    pmid: string;
    title: string;
    authors: string;
    journalCitation: string;
    snippet: string;
    position?: number;
}

export interface Affiliation {
    institution?: string;
    city?: string;
    country?: string;
    email?: string;
}

export interface Author {
    name: string;
    position?: number;
    affiliations: Affiliation[];
}

export interface Keyword {
    text: string;
    isMeSH?: boolean;
}

export interface Reference {
    pmid?: string;
    citation: string;
}

export interface SimilarArticle {
    pmid: string;
    title: string;
}

export interface FullTextSource {
    name: string;
    url: string;
    type?: string;
}

export interface ArticleDetail {
    doi: string;
    pmid: string;
    title: string;
    authors: Author[];
    affiliations: Affiliation[];
    abstract: string;
    keywords: Keyword[];
    conflictOfInterestStatement: string;
    similarArticles: SimilarArticle[];
    references: Reference[];
    publicationTypes: string[];
    meshTerms: Keyword[];
    relatedInformation: Record<string, string[]>;
    fullTextSources: FullTextSource[];
    journalInfo: {
        title?: string;
        volume?: string;
        issue?: string;
        pages?: string;
        pubDate?: string;
    };
}
