import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    JwtModule.register({
      secret: 'fl5ox03',
      signOptions: {
        expiresIn: '7d',
      }
    })
  ],
  controllers: [],
  providers: [],
  exports: [],
})
export class AuthLibModule {}
