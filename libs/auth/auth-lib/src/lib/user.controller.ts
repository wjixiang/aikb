import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { ZodValidationPipe } from './pipes/zod-validation.pipe';
import { UpdateUserSchema, UpdatePasswordSchema } from './auth.schema';
import type {
  UserQueryDto,
  UpdateUserDto,
  UpdatePasswordDto,
  UserResponse,
  UserDetailResponse,
  PaginatedResponse,
  ApiResponse
} from './auth.dto';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UserController {
  constructor(private readonly authService: AuthService) {}

  @Get()
  async getUsers(@Query() query: UserQueryDto): Promise<PaginatedResponse<UserResponse>> {
    return this.authService.getUsers(query);
  }

  @Get(':id')
  async getUserById(@Param('id', ParseUUIDPipe) id: string): Promise<UserDetailResponse> {
    return this.authService.getUserById(id);
  }

  @Put(':id')
  async updateUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateUserSchema)) updateUserDto: UpdateUserDto
  ): Promise<UserResponse> {
    return this.authService.updateUser(id, updateUserDto);
  }

  @Post(':id/password')
  async updatePassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdatePasswordSchema)) updatePasswordDto: UpdatePasswordDto
  ): Promise<ApiResponse> {
    return this.authService.updatePassword(id, updatePasswordDto);
  }

  @Delete(':id')
  async deleteUser(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse> {
    return this.authService.deleteUser(id);
  }

  @Get(':id/activity')
  async getUserActivity(@Param('id', ParseUUIDPipe) id: string) {
    return this.authService.getUserActivity(id);
  }
}