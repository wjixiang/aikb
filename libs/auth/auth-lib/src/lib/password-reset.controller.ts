import { 
  Controller, 
  Post, 
  Body 
} from '@nestjs/common';
import { AuthService } from './auth.service';
import type { 
  PasswordResetRequestDto, 
  PasswordResetConfirmDto,
  PasswordResetResponse
} from './auth.dto';

@Controller('password-reset')
export class PasswordResetController {
  constructor(private readonly authService: AuthService) {}

  @Post('request')
  async requestPasswordReset(@Body() passwordResetRequestDto: PasswordResetRequestDto): Promise<PasswordResetResponse> {
    return this.authService.requestPasswordReset(passwordResetRequestDto);
  }

  @Post('confirm')
  async confirmPasswordReset(@Body() passwordResetConfirmDto: PasswordResetConfirmDto): Promise<PasswordResetResponse> {
    return this.authService.confirmPasswordReset(passwordResetConfirmDto);
  }
}