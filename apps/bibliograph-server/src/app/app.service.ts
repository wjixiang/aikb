import { Injectable } from '@nestjs/common';
import {S3ElasticSearchLibraryStorage, ILibraryStorage} from '@aikb/bibliography'

@Injectable()
export class AppService {
  libraryStorage: ILibraryStorage | null = null
  private getLibraryStorage() {
    if(this.libraryStorage === null) {
      this.libraryStorage = new S3ElasticSearchLibraryStorage()
    }
    return this.libraryStorage
  }
  getData(): { message: string } {
    return { message: 'Hello API' };
  }

  createItem() {
    const storage = this.getLibraryStorage()
  }
}
