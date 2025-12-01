import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import type {
  UserSessionQueryDto,
  SessionResponse,
  ApiResponse,
} from './auth.dto';

@Controller('sessions')
@UseGuards(JwtAuthGuard)
export class SessionController {
  constructor(private readonly authService: AuthService) {}

  @Get()
  async getUserSessions(
    @Query() query: UserSessionQueryDto,
  ): Promise<SessionResponse[]> {
    return this.authService.getUserSessions(query);
  }

  @Delete(':sessionId')
  async revokeSession(
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
  ): Promise<ApiResponse> {
    return this.authService.revokeSession(sessionId);
  }

  @Delete('user/:userId')
  async revokeAllUserSessions(
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<ApiResponse> {
    return this.authService.revokeAllUserSessions(userId);
  }
}
