import { Controller } from '@nestjs/common';
import { Implement, implement } from '@orpc/nest';
import { authContract } from './orpc.contract';
import { AuthService } from '../auth.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { UseGuards } from '@nestjs/common';
import type { PasswordResetRequestDto, PasswordResetConfirmDto, PasswordResetResponse } from '../auth.dto';

@Controller()
export class ORPCPasswordResetController {
  constructor(private readonly authService: AuthService) {}

  @Implement(authContract.passwordReset)
  passwordReset() {
    return {
      request: implement(authContract.passwordReset.request).handler(async ({ input }: { input: PasswordResetRequestDto }) => {
        try {
          return await this.authService.requestPasswordReset(input) as PasswordResetResponse;
        } catch (error) {
          throw error;
        }
      }),
      
      confirm: implement(authContract.passwordReset.confirm).handler(async ({ input }: { input: PasswordResetConfirmDto }) => {
        try {
          return await this.authService.confirmPasswordReset(input) as PasswordResetResponse;
        } catch (error) {
          throw error;
        }
      }),
    };
  }
}