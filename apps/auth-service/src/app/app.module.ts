import { Module } from '@nestjs/common';
import { AuthLibModule } from 'auth-lib';

@Module({
  imports: [AuthLibModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
