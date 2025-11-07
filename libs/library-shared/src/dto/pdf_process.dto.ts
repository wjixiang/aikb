export class Pdf2MArkdownDto {
  constructor(
    public itemId: string,
    public pageNum: number | null = null
  ) {}
}
