import { FileType } from 'bibliography';

export class Pdf2MArkdownDto {
  constructor(
    public itemId: string,
    public fileType: FileType = 'pdf',
    public fileSize: number,
    public fileHash: string,
    public addDate: Date,
    public s3Key: string,
    public pageCount?: number,
    public wordCount?: number,
  ) {}
}
