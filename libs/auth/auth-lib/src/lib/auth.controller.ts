import { Controller, Post, Body, UseGuards, Req, Get, HttpStatus, HttpCode, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { LoginSchema, RegisterSchema } from './auth.schema';
import { ZodValidationPipe } from './pipes/zod-validation.pipe';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import type { Request } from 'express';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body(new ZodValidationPipe(RegisterSchema)) registerDto: any, @Res() res: Response): Promise<any> {
    const result = await this.authService.register(registerDto);
    // Set status code to 201 for successful registration
    return res.status(HttpStatus.CREATED).json(result);
  }

  @Post('login')
  async login(@Body(new ZodValidationPipe(LoginSchema)) loginDto: any, @Res() res: Response): Promise<any> {
    const result = await this.authService.login(loginDto);
    return res.status(HttpStatus.OK).json(result);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refreshToken(@Body('refreshToken') refreshToken: string, @Res() res: Response): Promise<any> {
    const result = await this.authService.refreshToken(refreshToken);
    return res.status(HttpStatus.OK).json(result);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(@Body('refreshToken') refreshToken: string, @Res() res: Response): Promise<any> {
    await this.authService.logout(refreshToken);
    return res.status(HttpStatus.OK).json({ message: '登出成功' });
  }

  @Get('validate')
  @UseGuards(JwtAuthGuard)
  async validate(@Req() req: Request & { user: any }) {
    return this.authService.validateUser(req.user);
  }
}