import { Controller, NotFoundException, BadRequestException } from '@nestjs/common';
import { Implement, implement } from '@orpc/nest';
import {
  listSessionsContract,
  revokeSessionContract,
  revokeAllUserSessionsContract
} from './orpc.contract';
import { AuthService } from '../auth.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { UseGuards } from '@nestjs/common';
import type {
  UserSessionQueryDto,
  SessionResponse,
  ApiResponse
} from '../auth.dto';

@Controller()
@UseGuards(JwtAuthGuard)
export class ORPCSessionController {
  constructor(private readonly authService: AuthService) {}

  @Implement(listSessionsContract)
  async listSessions(input: UserSessionQueryDto) {
    return implement(listSessionsContract).handler(async ({ input }) => {
      try {
        return await this.authService.getUserSessions(input) as SessionResponse[];
      } catch (error) {
        if (error instanceof BadRequestException) {
          throw error; // Re-throw to preserve status code
        }
        if (error instanceof NotFoundException) {
          throw error; // Re-throw to preserve status code
        }
        throw error;
      }
    });
  }
  
  @Implement(revokeSessionContract)
  async revokeSession(input: { sessionId: string }) {
    return implement(revokeSessionContract).handler(async ({ input }) => {
      try {
        return await this.authService.revokeSession(input.sessionId) as ApiResponse;
      } catch (error) {
        if (error instanceof NotFoundException) {
          throw error; // Re-throw to preserve status code
        }
        throw error;
      }
    });
  }
  
  @Implement(revokeAllUserSessionsContract)
  async revokeAllUserSessions(input: { userId: string }) {
    return implement(revokeAllUserSessionsContract).handler(async ({ input }) => {
      try {
        return await this.authService.revokeAllUserSessions(input.userId) as ApiResponse;
      } catch (error) {
        if (error instanceof BadRequestException) {
          throw error; // Re-throw to preserve status code
        }
        throw error;
      }
    });
  }
}