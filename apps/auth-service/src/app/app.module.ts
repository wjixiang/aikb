import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthLibModule } from 'auth-lib';

@Module({
  imports: [
    AuthLibModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
