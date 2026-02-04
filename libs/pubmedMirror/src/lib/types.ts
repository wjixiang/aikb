import { FileInfo } from "basic-ftp"

export interface SyncResult {
    total: number
    success: number
    error: number
}

export interface FileInfoExtended extends FileInfo {
    synced?: boolean
}