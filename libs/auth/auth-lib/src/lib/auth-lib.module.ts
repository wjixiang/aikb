import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { REQUEST } from '@nestjs/core';
import { ORPCModule } from '@orpc/nest';
import { onError } from '@orpc/nest';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UserController } from './user.controller';
import { SessionController } from './session.controller';
import { VerificationController } from './verification.controller';
import { PasswordResetController } from './password-reset.controller';
import { AdminController } from './admin.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { ORPCAuthController } from './orpc/orpc-auth.controller';
import { ORPCUserController } from './orpc/orpc-user.controller';
import { ORPCSessionController } from './orpc/orpc-session.controller';
import { ORPCVerificationController } from './orpc/orpc-verification.controller';
import { ORPCPasswordResetController } from './orpc/orpc-password-reset.controller';
import { ORPCAdminController } from './orpc/orpc-admin.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PassportModule,
    JwtModule.register({
      secret: 'fl5ox03',
      signOptions: {
        expiresIn: '7d',
      },
    }),
    ORPCModule.forRootAsync({
      useFactory: (request: Request) => ({
        interceptors: [
          onError((error) => {
            console.error('oRPC Error:', error);
            console.error('oRPC Error message:', error.message);
            console.error('oRPC Error name:', error.name);
            console.error('oRPC Error stack:', error.stack);

            // For NestJS HTTP exceptions, preserve the original error message and status
            if (
              error.name === 'ConflictException' ||
              error.name === 'UnauthorizedException'
            ) {
              // Re-throw the original NestJS exception to preserve status code
              throw error;
            }

            // For other HTTP exceptions
            if (error.name === 'HttpException') {
              // Re-throw the original NestJS exception to preserve status code
              throw error;
            }
          }),
        ],
        context: { request },
        eventIteratorKeepAliveInterval: 5000,
      }),
      inject: [REQUEST],
    }),
  ],
  controllers: [
    // AuthController,
    // UserController,
    // SessionController,
    // VerificationController,
    // PasswordResetController,
    // AdminController,
    ORPCAuthController,
    ORPCUserController,
    ORPCSessionController,
    ORPCVerificationController,
    ORPCPasswordResetController,
    ORPCAdminController,
  ],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService, JwtModule],
})
export class AuthLibModule {}
