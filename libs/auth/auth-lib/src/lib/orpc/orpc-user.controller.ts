import { Controller } from '@nestjs/common';
import { Implement, implement } from '@orpc/nest';
import {
  listUsersContract,
  findUserContract,
  updateUserContract,
  updateUserPasswordContract,
  deleteUserContract,
  getUserActivityContract,
} from './orpc.contract';
import { AuthService } from '../auth.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { UseGuards } from '@nestjs/common';
import type {
  UserQueryDto,
  UpdateUserDto,
  UpdatePasswordDto,
  UserResponse,
  UserDetailResponse,
  PaginatedResponse,
  ApiResponse,
  UserActivityResponse,
} from '../auth.dto';

@Controller()
@UseGuards(JwtAuthGuard)
export class ORPCUserController {
  constructor(private readonly authService: AuthService) {}

  @Implement(listUsersContract)
  listUsers() {
    return implement(listUsersContract).handler(
      async ({ input }: { input: UserQueryDto }) => {
        try {
          return (await this.authService.getUsers(
            input,
          )) as PaginatedResponse<UserResponse>;
        } catch (error) {
          throw error;
        }
      },
    );
  }

  @Implement(findUserContract)
  findUser() {
    return implement(findUserContract).handler(
      async ({ input }: { input: { id: string } }) => {
        try {
          return (await this.authService.getUserById(
            input.id,
          )) as UserDetailResponse;
        } catch (error: any) {
          // Re-throw NestJS exceptions to preserve error handling
          if (error.name === 'NotFoundException' || error.status === 404) {
            throw error;
          }
          throw error;
        }
      },
    );
  }

  @Implement(updateUserContract)
  updateUser() {
    return implement(updateUserContract).handler(
      async ({ input }: { input: { id: string; data: UpdateUserDto } }) => {
        try {
          return (await this.authService.updateUser(
            input.id,
            input.data,
          )) as UserResponse;
        } catch (error: any) {
          // Re-throw NestJS exceptions to preserve error handling
          if (error.name === 'NotFoundException' || error.status === 404) {
            throw error;
          }
          throw error;
        }
      },
    );
  }

  @Implement(updateUserPasswordContract)
  updateUserPassword() {
    return implement(updateUserPasswordContract).handler(
      async ({ input }: { input: { id: string; data: UpdatePasswordDto } }) => {
        try {
          return (await this.authService.updatePassword(
            input.id,
            input.data,
          )) as ApiResponse;
        } catch (error: any) {
          // Re-throw NestJS exceptions to preserve error handling
          if (error.name === 'BadRequestException' || error.status === 400) {
            throw error;
          }
          throw error;
        }
      },
    );
  }

  @Implement(deleteUserContract)
  deleteUser() {
    return implement(deleteUserContract).handler(
      async ({ input }: { input: { id: string } }) => {
        try {
          return (await this.authService.deleteUser(input.id)) as ApiResponse;
        } catch (error: any) {
          // Re-throw NestJS exceptions to preserve error handling
          if (error.name === 'NotFoundException' || error.status === 404) {
            throw error;
          }
          throw error;
        }
      },
    );
  }

  @Implement(getUserActivityContract)
  getUserActivity() {
    return implement(getUserActivityContract).handler(
      async ({ input }: { input: { id: string } }) => {
        try {
          return (await this.authService.getUserActivity(
            input.id,
          )) as UserActivityResponse;
        } catch (error: any) {
          // Re-throw NestJS exceptions to preserve error handling
          if (error.name === 'NotFoundException' || error.status === 404) {
            throw error;
          }
          throw error;
        }
      },
    );
  }
}
