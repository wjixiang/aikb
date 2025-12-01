import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from 'auth-lib';
import { MockAuthService } from './mock-auth.service';
import {
  AuthController,
  UserController,
  SessionController,
  VerificationController,
  PasswordResetController,
  AdminController,
} from 'auth-lib';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'fl5ox03',
      signOptions: { expiresIn: '1h' },
    }),
  ],
  controllers: [
    AuthController,
    UserController,
    SessionController,
    VerificationController,
    PasswordResetController,
    AdminController,
  ],
  providers: [MockAuthService, JwtStrategy],
  exports: [MockAuthService, JwtModule],
})
export class TestAuthLibModule {}
