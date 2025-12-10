import { Injectable } from '@nestjs/common';
import { buildApiHandler } from '.';

@Injectable()
export class ApiService {
  constructor() {}

  registerHandler = buildApiHandler;
}
