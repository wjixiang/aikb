import { Injectable } from '@nestjs/common';

@Injectable()
export class MedPortalService {
  getHello(): string {
    return 'Hello World!';
  }
}
