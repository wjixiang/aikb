import { ItemArchive } from 'bibliography';

export class Pdf2MArkdownDto {
  constructor(
    public itemId: string,
    public itemArchive: ItemArchive,
  ) {}
}
