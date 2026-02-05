import { FileInfo } from "basic-ftp"

export interface SyncResult {
    total: number
    success: number
    error: number
}

export interface FileInfoExtended extends FileInfo {
    synced?: boolean
}

export interface JournalInfo {
    pmid: number;
    country: string | null;
    title: string | null;
    ISOAbbreviation: string | null;
    medlineTA: string | null;
    nlmUniqueId: number | null;
    issn: string | null;
}