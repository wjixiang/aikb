import { Controller } from '@nestjs/common';
import { Implement, implement } from '@orpc/nest';
import { authContract } from './orpc.contract';
import { AuthService } from '../auth.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { UseGuards } from '@nestjs/common';
import type { BulkOperationDto, UserStatsResponse, BulkOperationResponse } from '../auth.dto';

@Controller()
@UseGuards(JwtAuthGuard)
export class ORPCAdminController {
  constructor(private readonly authService: AuthService) {}

  @Implement(authContract.admin)
  admin() {
    return {
      getStats: implement(authContract.admin.getStats).handler(async () => {
        try {
          return await this.authService.getUserStats() as UserStatsResponse;
        } catch (error) {
          throw error;
        }
      }),
      
      bulkOperation: implement(authContract.admin.bulkOperation).handler(async ({ input }: { input: BulkOperationDto }) => {
        try {
          return await this.authService.bulkOperation(input) as BulkOperationResponse;
        } catch (error) {
          throw error;
        }
      }),
    };
  }
}