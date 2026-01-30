import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
  Get,
  HttpStatus,
  HttpCode,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { LoginSchema, RegisterSchema, JwtPayloadSchema } from './auth.schema';
import { ZodValidationPipe } from './pipes/zod-validation.pipe';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import type { Request } from 'express';
import type { LoginDto, RegisterDto } from './auth.dto';
import { z } from 'zod';

type JwtUser = z.infer<typeof JwtPayloadSchema>;

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(
    @Body(new ZodValidationPipe(RegisterSchema)) registerDto: RegisterDto,
    @Res() res: Response,
  ): Promise<Response> {
    console.log(registerDto);
    const result = await this.authService.register(registerDto);
    // Set status code to 201 for successful registration
    return res.status(HttpStatus.CREATED).json(result);
  }

  @Post('login')
  async login(
    @Body(new ZodValidationPipe(LoginSchema)) loginDto: LoginDto,
    @Res() res: Response,
  ): Promise<Response> {
    const result = await this.authService.login(loginDto);
    return res.status(HttpStatus.OK).json(result);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refreshToken(
    @Body('refreshToken') refreshToken: string,
    @Res() res: Response,
  ): Promise<Response> {
    const result = await this.authService.refreshToken(refreshToken);
    return res.status(HttpStatus.OK).json(result);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(
    @Body('refreshToken') refreshToken: string,
    @Res() res: Response,
  ): Promise<Response> {
    await this.authService.logout(refreshToken);
    return res.status(HttpStatus.OK).json({ message: 'Logout successfully' });
  }

  @Get('validate')
  @UseGuards(JwtAuthGuard)
  async validate(@Req() req: Request & { user: JwtUser }) {
    return this.authService.validateUser(req.user);
  }

  @Post('unregister')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async unregister(
    @Req() req: Request & { user: JwtUser },
    @Res() res: Response,
  ): Promise<Response> {
    await this.authService.deleteUser(req.user.sub);
    return res
      .status(HttpStatus.OK)
      .json({ message: 'Unregister successfully' });
  }
}
