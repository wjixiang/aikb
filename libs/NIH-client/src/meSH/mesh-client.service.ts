import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';

@Injectable()
export class meSHClient {
  constructor(private readonly httpService: HttpService) {}

  async searchSingleTerm(term: string) {
    // this.httpService.get()
  }
}
