import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LibraryItemController } from './library-item.controller';
import { LibraryItemService } from './library-item.service';

@Module({
  imports: [],
  controllers: [AppController, LibraryItemController],
  providers: [AppService, LibraryItemService],
})
export class AppModule {}
