// libs/auth/auth-lib/src/lib/services/user-management.service.ts
import { Injectable, NotFoundException, ConflictException, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { prisma } from 'auth-db';
import * as bcrypt from 'bcryptjs';
import { z } from 'zod';
import {
  UserQueryDto,
  UpdateUserDto,
  UpdatePasswordDto,
  EmailVerificationDto,
  PhoneVerificationDto,
  PasswordResetRequestDto,
  PasswordResetConfirmDto,
  BulkOperationDto,
  UserSessionQueryDto,
  UserResponse,
  UserDetailResponse,
  PaginatedResponse,
  UserStatsResponse,
  SessionResponse,
  LoginLogResponse,
  VerificationResponse,
  PasswordResetResponse,
  BulkOperationResponse,
  UserActivityResponse,
  ApiResponse,
  LoginSchema,
  RegisterSchema,
  AuthResponseSchema,
  AuthResponse,
  LoginDto,
  RegisterDto
} from './auth.dto';



@Injectable()
export class AuthService {
  private readonly prisma = prisma;
  
  constructor(
    private readonly jwtService: JwtService
  ) {}

  /**
   * 获取用户列表（分页）
   */
  async getUsers(query: UserQueryDto): Promise<PaginatedResponse<UserResponse>> {
    const { page, limit, search, isActive, isEmailVerified, isPhoneVerified, sortBy, sortOrder } = query;
    
    const skip = (page - 1) * limit;
    
    // 构建查询条件
    const where: any = {};
    
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } }
      ];
    }
    
    if (isActive !== undefined) {
      where.isActive = isActive;
    }
    
    if (isEmailVerified !== undefined) {
      where.isEmailVerified = isEmailVerified;
    }
    
    if (isPhoneVerified !== undefined) {
      where.isPhoneVerified = isPhoneVerified;
    }
    
    // 获取总数
    const total = await this.prisma.user.count({ where });
    
    // 获取用户列表
    const users = await this.prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        phone: true,
        isEmailVerified: true,
        isPhoneVerified: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    
    const userResponses: UserResponse[] = users.map(user => ({
      id: user.id,
      email: user.email,
      name: user.name || undefined,
      avatar: user.avatar || undefined,
      phone: user.phone || undefined,
      isEmailVerified: user.isEmailVerified,
      isPhoneVerified: user.isPhoneVerified,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt || undefined,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    }));
    
    return {
      data: userResponses,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    };
  }

  /**
   * 根据ID获取用户详情
   */
  async getUserById(id: string): Promise<UserDetailResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });
    
    if (!user) {
      throw new NotFoundException('用户不存在');
    }
    
    // 获取关联数据
    const [refreshTokens, sessions, loginLogs, wechatAccounts, accounts] = await Promise.all([
      this.prisma.refreshToken.findMany({
        where: { userId: id },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      this.prisma.session.findMany({
        where: { userId: id },
        orderBy: { lastActivity: 'desc' },
        take: 10,
      }),
      this.prisma.loginLog.findMany({
        where: { userId: id },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      this.prisma.wechatAccount.findMany({
        where: { userId: id },
      }),
      this.prisma.account.findMany({
        where: { userId: id },
      }),
    ]);
    
    return {
      id: user.id,
      email: user.email,
      name: user.name || undefined,
      avatar: user.avatar || undefined,
      phone: user.phone || undefined,
      isEmailVerified: user.isEmailVerified,
      isPhoneVerified: user.isPhoneVerified,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt || undefined,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      refreshTokens,
      sessions,
      loginLogs,
      wechatAccounts,
      accounts,
    };
  }

  /**
   * 更新用户信息
   */
  async updateUser(id: string, updateUserDto: UpdateUserDto): Promise<UserResponse> {
    const { name, avatar, phone, isActive } = updateUserDto;
    
    // 检查用户是否存在
    const existingUser = await this.prisma.user.findUnique({
      where: { id },
    });
    
    if (!existingUser) {
      throw new NotFoundException('用户不存在');
    }
    
    // 如果更新手机号，检查是否已被使用
    if (phone && phone !== existingUser.phone) {
      const phoneExists = await this.prisma.user.findUnique({
        where: { phone },
      });
      
      if (phoneExists) {
        throw new ConflictException('手机号已被使用');
      }
    }
    
    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: {
        name,
        avatar,
        phone,
        isActive,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        phone: true,
        isEmailVerified: true,
        isPhoneVerified: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    
    return {
      id: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name || undefined,
      avatar: updatedUser.avatar || undefined,
      phone: updatedUser.phone || undefined,
      isEmailVerified: updatedUser.isEmailVerified,
      isPhoneVerified: updatedUser.isPhoneVerified,
      isActive: updatedUser.isActive,
      lastLoginAt: updatedUser.lastLoginAt || undefined,
      createdAt: updatedUser.createdAt,
      updatedAt: updatedUser.updatedAt,
    };
  }

  /**
   * 更新用户密码
   */
  async updatePassword(id: string, updatePasswordDto: UpdatePasswordDto): Promise<ApiResponse> {
    const { currentPassword, newPassword } = updatePasswordDto;
    
    const user = await this.prisma.user.findUnique({
      where: { id },
    });
    
    if (!user || !user.passwordHash || !user.passwordSalt) {
      throw new NotFoundException('用户不存在或密码未设置');
    }
    
    // 验证当前密码
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isCurrentPasswordValid) {
      throw new BadRequestException('当前密码错误');
    }
    
    // 检查新密码是否与当前密码相同
    const isSamePassword = await bcrypt.compare(newPassword, user.passwordHash);
    if (isSamePassword) {
      throw new BadRequestException('新密码不能与当前密码相同');
    }
    
    // 生成新密码哈希
    const saltRounds = 10;
    const passwordSalt = await bcrypt.genSalt(saltRounds);
    const passwordHash = await bcrypt.hash(newPassword, saltRounds);
    
    // 保存密码历史
    await this.prisma.passwordHistory.create({
      data: {
        userId: id,
        passwordHash: user.passwordHash,
        passwordSalt: user.passwordSalt,
        iterations: user.passwordIterations || 100000,
      },
    });
    
    // 更新密码
    await this.prisma.user.update({
      where: { id },
      data: {
        passwordHash,
        passwordSalt,
        passwordIterations: saltRounds,
        updatedAt: new Date(),
      },
    });
    
    // 撤销所有刷新令牌
    await this.prisma.refreshToken.updateMany({
      where: { userId: id },
      data: { isRevoked: true },
    });
    
    return {
      success: true,
      message: '密码更新成功',
      timestamp: new Date(),
    };
  }

  /**
   * 删除用户
   */
  async deleteUser(id: string): Promise<ApiResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });
    
    if (!user) {
      throw new NotFoundException('用户不存在');
    }
    
    await this.prisma.user.delete({
      where: { id },
    });
    
    return {
      success: true,
      message: '用户删除成功',
      timestamp: new Date(),
    };
  }

  /**
   * 获取用户统计信息
   */
  async getUserStats(): Promise<UserStatsResponse> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
    
    const [
      totalUsers,
      activeUsers,
      verifiedEmailUsers,
      verifiedPhoneUsers,
      newUsersThisMonth,
      newUsersThisWeek,
      totalLogins,
      successfulLogins,
      failedLogins,
      todayLogins,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { isActive: true } }),
      this.prisma.user.count({ where: { isEmailVerified: true } }),
      this.prisma.user.count({ where: { isPhoneVerified: true } }),
      this.prisma.user.count({ where: { createdAt: { gte: startOfMonth } } }),
      this.prisma.user.count({ where: { createdAt: { gte: startOfWeek } } }),
      this.prisma.loginLog.count(),
      this.prisma.loginLog.count({ where: { success: true } }),
      this.prisma.loginLog.count({ where: { success: false } }),
      this.prisma.loginLog.count({
        where: {
          createdAt: {
            gte: new Date(now.setHours(0, 0, 0, 0)),
          },
        },
      }),
    ]);
    
    return {
      totalUsers,
      activeUsers,
      verifiedEmailUsers,
      verifiedPhoneUsers,
      newUsersThisMonth,
      newUsersThisWeek,
      loginStats: {
        totalLogins,
        successfulLogins,
        failedLogins,
        todayLogins,
      },
    };
  }

  /**
   * 获取用户会话
   */
  async getUserSessions(query: UserSessionQueryDto): Promise<SessionResponse[]> {
    const { userId, isActive } = query;
    
    const where: any = { userId };
    if (isActive !== undefined) {
      where.isActive = isActive;
    }
    
    const sessions = await this.prisma.session.findMany({
      where,
      orderBy: { lastActivity: 'desc' },
      take: 50,
    });
    
    return sessions.map(session => ({
      id: session.id,
      sessionToken: session.sessionToken,
      userId: session.userId,
      expires: session.expires,
      createdAt: session.createdAt,
      lastActivity: session.lastActivity,
      clientInfo: session.clientInfo,
      isActive: session.isActive,
    }));
  }

  /**
   * 撤销用户会话
   */
  async revokeSession(sessionId: string): Promise<ApiResponse> {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
    });
    
    if (!session) {
      throw new NotFoundException('会话不存在');
    }
    
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { isActive: false },
    });
    
    return {
      success: true,
      message: '会话已撤销',
      timestamp: new Date(),
    };
  }

  /**
   * 撤销用户所有会话
   */
  async revokeAllUserSessions(userId: string): Promise<ApiResponse> {
    await this.prisma.session.updateMany({
      where: { userId },
      data: { isActive: false },
    });
    
    return {
      success: true,
      message: '所有会话已撤销',
      timestamp: new Date(),
    };
  }

  /**
   * 发送邮箱验证
   */
  async sendEmailVerification(emailVerificationDto: EmailVerificationDto): Promise<VerificationResponse> {
    const { email } = emailVerificationDto;
    
    const user = await this.prisma.user.findUnique({
      where: { email },
    });
    
    if (!user) {
      throw new NotFoundException('用户不存在');
    }
    
    if (user.isEmailVerified) {
      return {
        success: false,
        message: '邮箱已验证',
      };
    }
    
    // 生成验证令牌
    const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24小时后过期
    
    // 保存验证令牌
    await this.prisma.emailVerification.create({
      data: {
        email,
        token,
        expiresAt,
        userId: user.id,
      },
    });
    
    // TODO: 发送邮件
    
    return {
      success: true,
      message: '验证邮件已发送',
      token,
      expiresAt,
    };
  }

  /**
   * 验证邮箱
   */
  async verifyEmail(token: string): Promise<VerificationResponse> {
    const verification = await this.prisma.emailVerification.findUnique({
      where: { token },
      include: { user: true },
    });
    
    if (!verification) {
      return {
        success: false,
        message: '验证令牌无效',
      };
    }
    
    if (verification.expiresAt < new Date()) {
      return {
        success: false,
        message: '验证令牌已过期',
      };
    }
    
    // 更新用户邮箱验证状态
    await this.prisma.user.update({
      where: { id: verification.userId },
      data: { isEmailVerified: true },
    });
    
    // 删除验证令牌
    await this.prisma.emailVerification.delete({
      where: { id: verification.id },
    });
    
    return {
      success: true,
      message: '邮箱验证成功',
    };
  }

  /**
   * 请求密码重置
   */
  async requestPasswordReset(passwordResetRequestDto: PasswordResetRequestDto): Promise<PasswordResetResponse> {
    const { email } = passwordResetRequestDto;
    
    const user = await this.prisma.user.findUnique({
      where: { email },
    });
    
    if (!user) {
      // 为了安全，即使用户不存在也返回成功
      return {
        success: true,
        message: '如果邮箱存在，重置链接已发送',
      };
    }
    
    // 生成重置令牌
    const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1小时后过期
    
    // 保存重置令牌
    await this.prisma.passwordReset.create({
      data: {
        email,
        token,
        expiresAt,
        userId: user.id,
      },
    });
    
    // TODO: 发送重置邮件
    
    return {
      success: true,
      message: '密码重置链接已发送',
      token,
      expiresAt,
    };
  }

  /**
   * 确认密码重置
   */
  async confirmPasswordReset(passwordResetConfirmDto: PasswordResetConfirmDto): Promise<PasswordResetResponse> {
    const { token, newPassword } = passwordResetConfirmDto;
    
    const reset = await this.prisma.passwordReset.findUnique({
      where: { token },
      include: { user: true },
    });
    
    if (!reset) {
      return {
        success: false,
        message: '重置令牌无效',
      };
    }
    
    if (reset.expiresAt < new Date()) {
      return {
        success: false,
        message: '重置令牌已过期',
      };
    }
    
    if (reset.isUsed) {
      return {
        success: false,
        message: '重置令牌已被使用',
      };
    }
    
    // 生成新密码哈希
    const saltRounds = 10;
    const passwordSalt = await bcrypt.genSalt(saltRounds);
    const passwordHash = await bcrypt.hash(newPassword, saltRounds);
    
    // 保存密码历史
    if (reset.user.passwordHash) {
      await this.prisma.passwordHistory.create({
        data: {
          userId: reset.userId,
          passwordHash: reset.user.passwordHash,
          passwordSalt: reset.user.passwordSalt || '',
          iterations: reset.user.passwordIterations || 100000,
        },
      });
    }
    
    // 更新密码
    await this.prisma.user.update({
      where: { id: reset.userId },
      data: {
        passwordHash,
        passwordSalt,
        passwordIterations: saltRounds,
        updatedAt: new Date(),
      },
    });
    
    // 标记重置令牌为已使用
    await this.prisma.passwordReset.update({
      where: { id: reset.id },
      data: { isUsed: true },
    });
    
    // 撤销所有刷新令牌
    await this.prisma.refreshToken.updateMany({
      where: { userId: reset.userId },
      data: { isRevoked: true },
    });
    
    return {
      success: true,
      message: '密码重置成功',
    };
  }

  /**
   * 批量操作用户
   */
  async bulkOperation(bulkOperationDto: BulkOperationDto): Promise<BulkOperationResponse> {
    const { userIds, action } = bulkOperationDto;
    
    let processedCount = 0;
    let failedCount = 0;
    const errors: string[] = [];
    
    for (const userId of userIds) {
      try {
        switch (action) {
          case 'activate':
            await this.prisma.user.update({
              where: { id: userId },
              data: { isActive: true },
            });
            break;
          case 'deactivate':
            await this.prisma.user.update({
              where: { id: userId },
              data: { isActive: false },
            });
            // 撤销所有会话
            await this.prisma.session.updateMany({
              where: { userId },
              data: { isActive: false },
            });
            break;
          case 'delete':
            await this.prisma.user.delete({
              where: { id: userId },
            });
            break;
        }
        processedCount++;
      } catch (error) {
        failedCount++;
        errors.push(`用户 ${userId}: ${error instanceof Error ? error.message : '未知错误'}`);
      }
    }
    
    return {
      success: failedCount === 0,
      message: `批量操作完成，成功: ${processedCount}，失败: ${failedCount}`,
      processedCount,
      failedCount,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * 获取用户活动日志
   */
  async getUserActivity(userId: string): Promise<UserActivityResponse> {
    const loginLogs = await this.prisma.loginLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    
    const activities = loginLogs.map(log => ({
      type: 'LOGIN',
      description: log.success
        ? `成功登录 (${log.loginType})`
        : `登录失败: ${log.failureReason || '未知原因'}`,
      timestamp: log.createdAt,
      ip: log.ip,
      userAgent: log.userAgent || undefined,
    }));
    
    return {
      userId,
      activities,
    };
  }

  /**
   * 用户注册
   */
  async register(registerDto: RegisterDto): Promise<AuthResponse> {
    const { email, password, name } = registerDto;

    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new BadRequestException('邮箱格式无效');
    }

    // 验证密码长度
    if (password.length < 6) {
      throw new BadRequestException('密码长度至少6位');
    }

    // 检查用户是否已存在
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('用户已存在');
    }

    // 密码哈希处理
    const saltRounds = 10;
    const passwordSalt = await bcrypt.genSalt(saltRounds);
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // 创建用户
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        passwordSalt,
        passwordIterations: saltRounds,
        name,
      },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    // 生成令牌
    const tokens = await this.generateTokens(user);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name || undefined,
      },
      ...tokens,
    };
  }

  /**
   * 用户登录
   */
  async login(loginDto: LoginDto): Promise<AuthResponse> {
    const { email, password } = loginDto;

    // 查找用户
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user || !user.passwordHash || !user.passwordSalt) {
      throw new UnauthorizedException('邮箱或密码错误');
    }

    // 验证密码
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('邮箱或密码错误');
    }

    // 更新最后登录时间
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const userResponse = {
      id: user.id,
      email: user.email,
      name: user.name || undefined,
    };

    // 生成令牌
    const tokens = await this.generateTokens({
      id: userResponse.id,
      email: userResponse.email,
      name: userResponse.name || null,
    });

    return {
      user: userResponse,
      ...tokens,
    };
  }

  /**
   * 刷新令牌
   */
  async refreshToken(refreshToken: string): Promise<any> {
    if (!refreshToken) {
      throw new UnauthorizedException('刷新令牌不能为空');
    }

    try {
      // 验证刷新令牌
      const payload = this.jwtService.verify(refreshToken, {
        secret: process.env['JWT_REFRESH_SECRET'] || 'fl5ox03',
      });

      // 查找用户
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          email: true,
          name: true,
        },
      });

      if (!user) {
        throw new UnauthorizedException('用户不存在');
      }

      // 检查刷新令牌是否存在于数据库且未被撤销
      const tokenRecord = await this.prisma.refreshToken.findFirst({
        where: {
          token: refreshToken,
          userId: user.id,
          isRevoked: false,
          expiresAt: {
            gt: new Date(),
          },
        },
      });

      if (!tokenRecord) {
        throw new UnauthorizedException('无效的刷新令牌');
      }

      // 撤销旧的刷新令牌
      await this.prisma.refreshToken.update({
        where: { id: tokenRecord.id },
        data: { isRevoked: true },
      });

      // 生成新令牌
      const tokens = await this.generateTokens({
        id: user.id,
        email: user.email,
        name: user.name || null,
      });

      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name || undefined,
        },
        ...tokens,
      };
    } catch (error) {
      throw new UnauthorizedException('无效的刷新令牌');
    }
  }

  /**
   * 验证用户
   */
  async validateUser(payload: any): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        name: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('用户不存在或已被禁用');
    }

    return user;
  }

  /**
   * 登出
   */
  async logout(refreshToken: string): Promise<void> {
    if (!refreshToken) {
      throw new BadRequestException('刷新令牌不能为空');
    }

    const result = await this.prisma.refreshToken.updateMany({
      where: { token: refreshToken },
      data: { isRevoked: true },
    });

    if (result.count === 0) {
      throw new BadRequestException('刷新令牌不存在或已被撤销');
    }
  }

  /**
   * 生成JWT令牌
   */
  private async generateTokens(user: { id: string; email: string; name: string| null }) {
    const payload = {
      sub: user.id,
      email: user.email,
    };

    // 生成访问令牌
    const accessToken = this.jwtService.sign(payload, {
      secret: process.env['JWT_SECRET'] || 'fl5ox03',
      expiresIn: process.env['JWT_EXPIRATION'] || '15m',
    } as any);

    // 生成刷新令牌
    const refreshToken = this.jwtService.sign(payload, {
      secret: process.env['JWT_REFRESH_SECRET'] || 'fl5ox03',
      expiresIn: process.env['JWT_REFRESH_EXPIRATION'] || '7d',
    } as any);

    // 保存刷新令牌到数据库
    try {
      await this.prisma.refreshToken.create({
        data: {
          token: refreshToken,
          userId: user.id,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7天后过期
        },
      });
    } catch (error) {
      // 如果令牌已存在，忽略错误（可能是重复生成）
      console.warn('Refresh token already exists, continuing...');
    }

    return {
      accessToken,
      refreshToken,
    };
  }
}