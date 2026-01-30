import { Controller, Post, Get, Body, Param, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import type {
  EmailVerificationDto,
  PhoneVerificationDto,
  VerificationResponse,
} from './auth.dto';

@Controller('verification')
export class VerificationController {
  constructor(private readonly authService: AuthService) {}

  @Post('email/send')
  async sendEmailVerification(
    @Body() emailVerificationDto: EmailVerificationDto,
  ): Promise<VerificationResponse> {
    return this.authService.sendEmailVerification(emailVerificationDto);
  }

  @Get('email/verify/:token')
  async verifyEmail(
    @Param('token') token: string,
  ): Promise<VerificationResponse> {
    return this.authService.verifyEmail(token);
  }

  @Post('phone/verify')
  @UseGuards(JwtAuthGuard)
  async verifyPhone(
    @Body() phoneVerificationDto: PhoneVerificationDto,
  ): Promise<VerificationResponse> {
    // TODO: Implement phone verification logic in AuthService
    return {
      success: false,
      message: '手机验证功能暂未实现',
    };
  }
}
