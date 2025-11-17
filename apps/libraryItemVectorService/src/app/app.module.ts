import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
// import { LibraryItemVectorController } from '../grpc/library-item-vector.grpc.controller';
// import { LibraryItemVectorService } from './library-item-vector/library-item-vector.service';

@Module({
  imports: [],
  controllers: [AppController ],
  providers: [AppService],
})
export class AppModule {}
