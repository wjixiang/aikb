import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { ZodValidationPipe } from './pipes/zod-validation.pipe';
import { BulkOperationSchema } from './auth.schema';
import type {
  BulkOperationDto,
  BulkOperationResponse,
  UserStatsResponse
} from './auth.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard)
export class AdminController {
  constructor(private readonly authService: AuthService) {}

  @Get('stats')
  async getUserStats(): Promise<UserStatsResponse> {
    return this.authService.getUserStats();
  }

  @Post('bulk-operation')
  async bulkOperation(@Body(new ZodValidationPipe(BulkOperationSchema)) bulkOperationDto: BulkOperationDto): Promise<BulkOperationResponse> {
    return this.authService.bulkOperation(bulkOperationDto);
  }
}