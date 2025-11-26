import { Controller, ConflictException, UnauthorizedException } from '@nestjs/common';
import { Implement, implement } from '@orpc/nest';
import { registerContract, loginContract, refreshContract, logoutContract, validateContract } from './orpc.contract';
import { AuthService } from '../auth.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { UseGuards } from '@nestjs/common';
import type { RegisterDto, LoginDto } from '../auth.dto';

@Controller()
export class ORPCAuthController {
  constructor(private readonly authService: AuthService) {}

  @Implement(registerContract)
  async register(input: RegisterDto) {
    return implement(registerContract).handler(async ({ input }) => {
      try {
        return await this.authService.register(input);
      } catch (error) {
        if (error instanceof ConflictException) {
          const response = (error as any).getResponse();
          const message = response?.message || error.message || '用户已存在';
          // Re-throw the original NestJS exception to preserve status code
          throw new ConflictException(message);
        }
        throw error;
      }
    });
  }
  
  @Implement(loginContract)
  async login(input: LoginDto) {
    return implement(loginContract).handler(async ({ input }) => {
      try {
        return await this.authService.login(input);
      } catch (error) {
        if (error instanceof UnauthorizedException) {
          const response = (error as any).getResponse();
          const message = response?.message || error.message || '邮箱或密码错误';
          // Re-throw the original NestJS exception to preserve status code
          throw new UnauthorizedException(message);
        }
        throw error;
      }
    });
  }
  
  @Implement(refreshContract)
  async refresh(input: { refreshToken: string }) {
    return implement(refreshContract).handler(async ({ input }) => {
      try {
        return await this.authService.refreshToken(input.refreshToken);
      } catch (error) {
        if (error instanceof UnauthorizedException) {
          const response = (error as any).getResponse();
          const message = response?.message || error.message || '无效的刷新令牌';
          // Re-throw the original NestJS exception to preserve status code
          throw new UnauthorizedException(message);
        }
        throw error;
      }
    });
  }
  
  @Implement(logoutContract)
  @UseGuards(JwtAuthGuard)
  async logout(input: { refreshToken: string }) {
    return implement(logoutContract).handler(async ({ input }) => {
      await this.authService.logout(input.refreshToken);
      return {
        success: true,
        message: '登出成功',
        timestamp: new Date()
      };
    });
  }
  
  @Implement(validateContract)
  @UseGuards(JwtAuthGuard)
  async validate() {
    return implement(validateContract).handler(async () => {
      // For now, return a mock response that matches the schema
      // TODO: Implement proper JWT context access
      return {
        id: '550e8400-e29b-41d4-a716-446655440000',
        email: 'test@example.com',
        name: 'Test User',
        isEmailVerified: true,
        isPhoneVerified: false,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    });
  }
}