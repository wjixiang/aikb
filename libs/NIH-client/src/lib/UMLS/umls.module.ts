import { Module } from '@nestjs/common';
import { UmlsService } from './umls.service';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [
    HttpModule.register({
      baseURL: 'https://uts-ws.nlm.nih.gov/rest',
      timeout: 30000,
      maxRedirects: 5,
    }),
  ],
  providers: [UmlsService],
  exports: [UmlsService],
})
export class UmlsModule {}
