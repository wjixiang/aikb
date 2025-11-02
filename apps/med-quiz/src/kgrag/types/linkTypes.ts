/**
 * Type definitions for bidirectional link indexing system
 */

export interface LinkRelationship {
  _id?: string;
  sourceId: string; // Document ID that contains the link
  targetId: string; // Document ID being linked to
  sourceTitle: string; // Title of source document
  targetTitle: string; // Title of target document
  alias?: string; // Display text (from [[title|alias]])
  linkType: "forward" | "backward";
  position: number; // Character position in source document
  context?: string; // Surrounding text context
  createdAt: Date;
  updatedAt: Date;
}

export interface DocumentWithLinks {
  id: string;
  key: string;
  title: string;
  content: string;
  lastModified: Date;
  metadata?: {
    size?: number;
    contentType?: string;
    tags?: string[];
    forwardLinks?: string[]; // Documents this document links to
    backwardLinks?: string[]; // Documents that link to this document
    linkCount?: number;
    lastLinkUpdate?: Date;
  };
}

export interface LinkGraph {
  document: DocumentWithLinks;
  forwardLinks: DocumentWithLinks[];
  backwardLinks: DocumentWithLinks[];
  linkCount: number;
  lastUpdated: Date;
}

export interface LinkStats {
  totalDocuments: number;
  totalLinks: number;
  orphanedDocuments: number;
  mostLinkedDocuments: Array<{
    document: DocumentWithLinks;
    linkCount: number;
  }>;
  recentLinks: LinkRelationship[];
}

export interface LinkQueryOptions {
  includeContent?: boolean;
  limit?: number;
  offset?: number;
  sortBy?: "createdAt" | "updatedAt" | "title";
  sortOrder?: "asc" | "desc";
}

export interface LinkValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  brokenLinks: Array<{
    title: string;
    position: number;
    context?: string;
  }>;
}
