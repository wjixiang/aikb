import { Controller } from '@nestjs/common';
import { Implement, implement } from '@orpc/nest';
import { authContract } from './orpc.contract';
import { AuthService } from '../auth.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { UseGuards } from '@nestjs/common';
import type {
  EmailVerificationDto,
  PhoneVerificationDto,
  VerificationResponse,
} from '../auth.dto';

@Controller()
export class ORPCVerificationController {
  constructor(private readonly authService: AuthService) {}

  @Implement(authContract.verification)
  verification() {
    return {
      sendEmail: implement(authContract.verification.sendEmail).handler(
        async ({ input }: { input: EmailVerificationDto }) => {
          try {
            return (await this.authService.sendEmailVerification(
              input,
            )) as VerificationResponse;
          } catch (error) {
            throw error;
          }
        },
      ),

      verifyEmail: implement(authContract.verification.verifyEmail).handler(
        async ({ input }: { input: { token: string } }) => {
          try {
            return (await this.authService.verifyEmail(
              input.token,
            )) as VerificationResponse;
          } catch (error) {
            throw error;
          }
        },
      ),

      verifyPhone: implement(authContract.verification.verifyPhone).handler(
        async ({ input }: { input: PhoneVerificationDto }) => {
          try {
            // Phone verification is not implemented yet
            return {
              success: false,
              message: '手机验证功能暂未实现',
            } as VerificationResponse;
          } catch (error) {
            throw error;
          }
        },
      ),
    };
  }
}
