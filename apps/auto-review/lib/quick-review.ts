import * as XLSX from 'xlsx';
import { config } from 'dotenv'
config()
export interface XlsxRow {
    [key: string]: string | number | boolean | null;
}

export async function readXlsxFile<T extends XlsxRow = XlsxRow>(
    filePath: string,
    sheetName?: string,
): Promise<T[]> {
    const workbook = XLSX.readFile(filePath);
    const sheet = sheetName ?? workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheet];
    const data = XLSX.utils.sheet_to_json(worksheet) as T[];
    return data;
}

export function readXlsxBuffer<T extends XlsxRow = XlsxRow>(
    buffer: Buffer,
    sheetName?: string,
): T[] {
    const workbook = XLSX.read(buffer);
    const sheet = sheetName ?? workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheet];
    const data = XLSX.utils.sheet_to_json(worksheet) as T[];
    return data;
}
