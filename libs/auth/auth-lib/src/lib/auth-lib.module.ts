import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UserController } from './user.controller';
import { SessionController } from './session.controller';
import { VerificationController } from './verification.controller';
import { PasswordResetController } from './password-reset.controller';
import { AdminController } from './admin.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { authPrismaService } from 'auth-db';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PassportModule,
    JwtModule.register({
      secret: process.env['JWT_SECRET'] || 'fl5ox03',
      signOptions: {
        expiresIn: '7d',
      },
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
  providers: [AuthService, JwtStrategy, authPrismaService],
  exports: [AuthService, JwtModule, JwtStrategy],
})
export class AuthLibModule { }
